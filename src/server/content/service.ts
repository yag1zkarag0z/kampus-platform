import "server-only";

import { Buffer } from "node:buffer";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type {
  ContentAuthorDto,
  ContentCommentDto,
  ContentDocumentDto,
  ContentGifDto,
  ContentImageDto,
  ContentListingDto,
  ContentPollDto,
  ContentPostDetailDto,
  ContentPostDto,
} from "@/content/types";
import {
  CAMPUS_TIME_ZONE,
  CAMPUS_TRENDING_COMMENT_WEIGHT,
  CAMPUS_TRENDING_LIKE_WEIGHT,
  CAMPUS_TRENDING_POLL_VOTE_WEIGHT,
  CAMPUS_TRENDING_WINDOW_DAYS,
  getCampusDateKey,
  isCampusDateKey,
} from "@/content/trending";
import { AuthError } from "@/server/auth/errors";
import {
  commentInteractableByViewer,
  commentVisibleToViewer,
  postVisibleToViewer,
} from "@/server/content/visibility";
import { getDatabase } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { resolveGiphyGif } from "@/server/giphy/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  recordCommentNotification,
  recordLikeNotification,
  recordMentionNotifications,
} from "@/server/notifications/service";
import {
  comments,
  documentAssets,
  follows,
  listings,
  mediaAssets,
  commentLikes,
  postBookmarks,
  postDocuments,
  postLikes,
  pollOptions,
  polls,
  pollVotes,
  postImages,
  posts,
  users,
  type Post,
} from "@/server/db/schema";

import {
  validateFinalPostContent,
  type BookmarksQueryInput,
  type CreateCommentInput,
  type CreatePostInput,
  type FeedQueryInput,
  type UpdateCommentInput,
  type UpdatePostInput,
} from "./validation";

export type {
  ContentCommentDto,
  ContentPostDetailDto,
  ContentPostDto,
} from "@/content/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
// hasDocument filtresi eklendi; eski biçimli cursor'lar burada geçersiz
// sayılır (sayfalama baştan başlar), sessizce yanlış yorumlanmaz.
const CURSOR_VERSION = 6;
const BOOKMARK_CURSOR_VERSION = 1;
const POST_COMMENT_TOTAL_LIMIT = 500;

type FeedCursor = {
  version: typeof CURSOR_VERSION;
  sort: FeedQueryInput["sort"];
  category: FeedQueryInput["category"] | null;
  hasDocument: boolean;
  author: string | null;
  scope: FeedQueryInput["scope"];
  q: string | null;
  createdAt: Date;
  id: string;
  /** popular sıralamasında beğeni, trending sıralamasında etkileşim puanı. */
  rank: number | null;
  /** Trending sayfaları gece yarısından sonra da aynı tarih penceresinde kalır. */
  trendingAnchorDate: string | null;
  /** Bugün 6, yedi günlük pencerenin son günü 0. */
  trendingDayRank: number | null;
};

type BookmarkCursor = {
  version: typeof BOOKMARK_CURSOR_VERSION;
  bookmarkedAt: Date;
  postId: string;
};

type PostRow = {
  id: string;
  authorId: string;
  category: Post["category"];
  isAnonymous: boolean;
  title: string;
  body: string;
  gifId: string | null;
  gifUrl: string | null;
  gifWidth: number | null;
  gifHeight: number | null;
  gifAlt: string | null;
  createdAt: Date;
  editedAt: Date | null;
  hiddenAt: Date | null;
  username: string;
  displayName: string;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
};

type BookmarkRow = PostRow & {
  bookmarkedAt: Date;
};

type CommentRow = {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  isAnonymous: boolean;
  body: string;
  gifId: string | null;
  gifUrl: string | null;
  gifWidth: number | null;
  gifHeight: number | null;
  gifAlt: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  username: string;
  displayName: string;
  authorDeletedAt: Date | null;
  likeCount: number;
  replyCount: number;
  liked: boolean;
};

type PollView = {
  poll: ContentPollDto;
  selectedOptionId: string | null;
};

function gifFromRow(row: {
  gifId: string | null;
  gifUrl: string | null;
  gifWidth: number | null;
  gifHeight: number | null;
  gifAlt: string | null;
}): ContentGifDto | null {
  if (!row.gifId || !row.gifUrl || !row.gifWidth || !row.gifHeight || !row.gifAlt) {
    return null;
  }

  return {
    id: row.gifId,
    src: row.gifUrl,
    width: row.gifWidth,
    height: row.gifHeight,
    alt: row.gifAlt,
  };
}

type ContentDatabase = ReturnType<typeof getDatabase>;
type ContentTransaction = Parameters<
  Parameters<ContentDatabase["transaction"]>[0]
>[0];
type ContentReadExecutor = ContentDatabase | ContentTransaction;

function postNotFoundError() {
  return new AuthError(
    "POST_NOT_FOUND",
    "Gönderi bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

function commentNotFoundError() {
  return new AuthError(
    "COMMENT_NOT_FOUND",
    "Yorum bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

function contentForbiddenError() {
  return new AuthError(
    "CONTENT_FORBIDDEN",
    "Bu içerik üzerinde işlem yapma yetkin bulunmuyor.",
    { status: 403 },
  );
}

function contentLimitReachedError() {
  return new AuthError(
    "CONTENT_LIMIT_REACHED",
    "Bu gönderi yorum sınırına ulaştı.",
    { status: 409 },
  );
}

function authenticationRequiredError() {
  return new AuthError(
    "AUTHENTICATION_REQUIRED",
    "Devam etmek için öğrenci hesabınla giriş yapmalısın.",
    { status: 401 },
  );
}

function invalidCursorError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Sayfalama anahtarı geçersiz.",
    {
      fieldErrors: {
        cursor: ["Akışı baştan yükleyip yeniden dene."],
      },
      status: 400,
    },
  );
}

function assertUuid(value: string, notFound: () => AuthError) {
  if (!UUID_PATTERN.test(value)) {
    throw notFound();
  }
}

async function assertActiveContentMember(
  transaction: ContentTransaction,
  userId: string,
) {
  const [activeUser] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .for("share")
    .limit(1);

  if (!activeUser) {
    throw authenticationRequiredError();
  }
}

/** Lock and return a post only after applying the canonical read policy. */
async function assertActivePostForInteraction(
  transaction: ContentTransaction,
  postId: string,
  viewerId: string,
) {
  const [activePost] = await transaction
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.id, postId),
        postVisibleToViewer(viewerId),
      ),
    )
    .for("share")
    .limit(1);

  if (!activePost) {
    throw postNotFoundError();
  }

  return activePost;
}

async function lockContentKeys(
  transaction: ContentTransaction,
  lockKeys: string[],
) {
  const orderedKeys = [...new Set(lockKeys)].sort();

  for (const lockKey of orderedKeys) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    );
  }
}

async function assertCommentCreationAllowed(
  transaction: ContentTransaction,
  viewerId: string,
  postId: string,
  now: Date,
) {
  await lockContentKeys(transaction, [`content-comment-post:${postId}`]);

  // Üye başına dakika sınırı ortak hız sınırı katmanından gelir; burada
  // yalnızca gönderi başına toplam yorum tavanı kalıyor.
  await consumeRateLimit(transaction, viewerId, "comment_create", now);

  const [postUsage] = await transaction
    .select({ total: count() })
    .from(comments)
    .where(eq(comments.postId, postId));

  if ((postUsage?.total ?? 0) >= POST_COMMENT_TOTAL_LIMIT) {
    throw contentLimitReachedError();
  }
}

type FeedCursorBinding = Pick<
  FeedQueryInput,
  "author" | "category" | "hasDocument" | "q" | "sort" | "scope"
>;

function feedRowRank(
  row: Pick<PostRow, "likeCount"> & { trendingScore?: number },
  sort: FeedQueryInput["sort"],
) {
  if (sort === "popular") {
    return Number(row.likeCount);
  }

  if (sort === "trending") {
    return Number(row.trendingScore ?? 0);
  }

  return null;
}

function encodeFeedCursor(
  row: Pick<PostRow, "createdAt" | "id" | "likeCount"> & {
    trendingScore?: number;
    trendingDayRank?: number;
  },
  query: FeedCursorBinding,
  trendingAnchorDate: string | null,
) {
  return Buffer.from(
    JSON.stringify({
      version: CURSOR_VERSION,
      sort: query.sort,
      category: query.category ?? null,
      hasDocument: query.hasDocument ?? false,
      author: query.author ?? null,
      scope: query.scope,
      q: query.q ?? null,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      rank: feedRowRank(row, query.sort),
      trendingAnchorDate,
      trendingDayRank:
        query.sort === "trending"
          ? Number(row.trendingDayRank ?? 0)
          : null,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeFeedCursor(
  value: string,
  query: FeedCursorBinding,
): FeedCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("version" in decoded) ||
      decoded.version !== CURSOR_VERSION ||
      !("sort" in decoded) ||
      (decoded.sort !== "newest" &&
        decoded.sort !== "popular" &&
        decoded.sort !== "trending") ||
      !("category" in decoded) ||
      (decoded.category !== null &&
        typeof decoded.category !== "string") ||
      !("hasDocument" in decoded) ||
      typeof decoded.hasDocument !== "boolean" ||
      !("author" in decoded) ||
      (decoded.author !== null && typeof decoded.author !== "string") ||
      !("scope" in decoded) ||
      (decoded.scope !== "global" && decoded.scope !== "following") ||
      !("q" in decoded) ||
      (decoded.q !== null && typeof decoded.q !== "string") ||
      !("createdAt" in decoded) ||
      typeof decoded.createdAt !== "string" ||
      !("id" in decoded) ||
      typeof decoded.id !== "string" ||
      !UUID_PATTERN.test(decoded.id) ||
      !("rank" in decoded) ||
      (decoded.rank !== null &&
        (typeof decoded.rank !== "number" ||
          !Number.isSafeInteger(decoded.rank) ||
          decoded.rank < 0)) ||
      !("trendingAnchorDate" in decoded) ||
      (decoded.trendingAnchorDate !== null &&
        !isCampusDateKey(decoded.trendingAnchorDate)) ||
      !("trendingDayRank" in decoded) ||
      (decoded.trendingDayRank !== null &&
        (typeof decoded.trendingDayRank !== "number" ||
          !Number.isSafeInteger(decoded.trendingDayRank) ||
          decoded.trendingDayRank < 0 ||
          decoded.trendingDayRank >= CAMPUS_TRENDING_WINDOW_DAYS))
    ) {
      throw invalidCursorError();
    }

    if (
      decoded.category !== (query.category ?? null) ||
      decoded.hasDocument !== (query.hasDocument ?? false) ||
      decoded.author !== (query.author ?? null) ||
      decoded.sort !== query.sort ||
      decoded.scope !== query.scope ||
      decoded.q !== (query.q ?? null) ||
      (query.sort === "newest") !== (decoded.rank === null) ||
      (query.sort === "trending") !==
        (decoded.trendingAnchorDate !== null &&
          decoded.trendingDayRank !== null) ||
      (query.sort !== "trending" &&
        (decoded.trendingAnchorDate !== null ||
          decoded.trendingDayRank !== null))
    ) {
      throw invalidCursorError();
    }

    const createdAt = new Date(decoded.createdAt);

    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== decoded.createdAt
    ) {
      throw invalidCursorError();
    }

    return {
      version: CURSOR_VERSION,
      sort: decoded.sort,
      category: decoded.category as FeedQueryInput["category"] | null,
      hasDocument: decoded.hasDocument,
      author: decoded.author,
      scope: decoded.scope,
      q: decoded.q,
      createdAt,
      id: decoded.id,
      rank: decoded.rank,
      trendingAnchorDate: decoded.trendingAnchorDate,
      trendingDayRank: decoded.trendingDayRank,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw invalidCursorError();
  }
}

function encodeBookmarkCursor(row: Pick<BookmarkRow, "bookmarkedAt" | "id">) {
  return Buffer.from(
    JSON.stringify({
      version: BOOKMARK_CURSOR_VERSION,
      bookmarkedAt: row.bookmarkedAt.toISOString(),
      postId: row.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeBookmarkCursor(value: string): BookmarkCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("version" in decoded) ||
      decoded.version !== BOOKMARK_CURSOR_VERSION ||
      !("bookmarkedAt" in decoded) ||
      typeof decoded.bookmarkedAt !== "string" ||
      !("postId" in decoded) ||
      typeof decoded.postId !== "string" ||
      !UUID_PATTERN.test(decoded.postId)
    ) {
      throw invalidCursorError();
    }

    const bookmarkedAt = new Date(decoded.bookmarkedAt);

    if (
      !Number.isFinite(bookmarkedAt.getTime()) ||
      bookmarkedAt.toISOString() !== decoded.bookmarkedAt
    ) {
      throw invalidCursorError();
    }

    return {
      version: BOOKMARK_CURSOR_VERSION,
      bookmarkedAt,
      postId: decoded.postId,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw invalidCursorError();
  }
}

/**
 * LIKE joker karakterlerini kaçırır; aksi hâlde "%" yazan bir arama tüm
 * gönderilerle eşleşirdi. Kaçış karakteri PostgreSQL'in varsayılanı olan
 * ters bölü, normalizasyon fonksiyonu ise bu karakterlere dokunmuyor.
 */
function escapeSearchPattern(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

/**
 * Arama, `kampus_search_text` ile normalize edilmiş başlık/gövde ve herkese
 * açık gönderilerde yazar adı üzerinde yapılır. Anonim gönderiler yazar
 * eşleşmesine dahil edilmez; arama anonimliği dolaylı biçimde sızdıramaz.
 */
function postSearchFilter(term: string): SQL {
  const escapedTerm = escapeSearchPattern(term);

  return or(
    sql`kampus_search_text(${posts.title} || ' ' || ${posts.body})
      like '%' || kampus_search_text(${escapedTerm}) || '%'`,
    and(
      eq(posts.isAnonymous, false),
      sql`kampus_search_text(${users.displayName} || ' ' || ${users.username})
        like '%' || kampus_search_text(${escapedTerm}) || '%'`,
    ),
  )!;
}

function anonymousAuthor(): ContentAuthorDto {
  return {
    id: null,
    username: null,
    displayName: "Anonim",
    avatarUrl: null,
  };
}

function deletedAuthor(): ContentAuthorDto {
  return {
    id: null,
    username: null,
    displayName: "Silinen kullanıcı",
    avatarUrl: null,
  };
}

function visibleAuthor({
  displayName,
  id,
  username,
}: {
  displayName: string;
  id: string;
  username: string;
}): ContentAuthorDto {
  return {
    id,
    username,
    displayName,
    avatarUrl: null,
  };
}

function serializePost(
  row: PostRow,
  viewerId: string,
  pollView?: PollView,
  listing?: ContentListingDto,
  image?: ContentImageDto,
  document?: ContentDocumentDto,
): ContentPostDto {
  return {
    id: row.id,
    category: row.category,
    isAnonymous: row.isAnonymous,
    title: row.title,
    body: row.body,
    author: row.isAnonymous
      ? anonymousAuthor()
      : visibleAuthor({
          id: row.authorId,
          username: row.username,
          displayName: row.displayName,
        }),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    likeCount: Number(row.likeCount),
    commentCount: Number(row.commentCount),
    poll: pollView?.poll ?? null,
    listing: listing ?? null,
    image: image ?? null,
    gif: gifFromRow(row),
    document: document ?? null,
    viewerState: {
      isAuthor: row.authorId === viewerId,
      canEdit: row.authorId === viewerId,
      canDelete: row.authorId === viewerId,
      liked: row.liked,
      bookmarked: row.bookmarked,
      // Gizlenmiş gönderiyi yalnızca yazarı görür; sessizce kaybolmaması
      // için durum arayüze taşınıyor.
      hidden: row.hiddenAt !== null,
      selectedPollOptionId: pollView?.selectedOptionId ?? null,
    },
  };
}

async function selectPostImages(
  executor: ContentReadExecutor,
  postIds: string[],
) {
  const result = new Map<string, ContentImageDto>();

  if (postIds.length === 0) return result;

  const rows = await executor
    .select({
      postId: postImages.postId,
      assetId: postImages.assetId,
      alt: postImages.alt,
      width: mediaAssets.width,
      height: mediaAssets.height,
    })
    .from(postImages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, postImages.assetId))
    .where(inArray(postImages.postId, postIds));

  for (const row of rows) {
    result.set(row.postId, {
      id: row.assetId,
      src: `/v1/media/${row.assetId}`,
      width: row.width,
      height: row.height,
      alt: row.alt,
    });
  }

  return result;
}

async function selectPostDocuments(
  executor: ContentReadExecutor,
  postIds: string[],
) {
  const result = new Map<string, ContentDocumentDto>();

  if (postIds.length === 0) return result;

  const rows = await executor
    .select({
      postId: postDocuments.postId,
      assetId: postDocuments.assetId,
      fileName: documentAssets.fileName,
      sizeBytes: documentAssets.sizeBytes,
    })
    .from(postDocuments)
    .innerJoin(documentAssets, eq(documentAssets.id, postDocuments.assetId))
    .where(inArray(postDocuments.postId, postIds));

  for (const row of rows) {
    result.set(row.postId, {
      id: row.assetId,
      name: row.fileName,
      sizeBytes: row.sizeBytes,
      src: `/v1/media/documents/${row.assetId}`,
    });
  }

  return result;
}

async function selectPostListings(
  executor: ContentReadExecutor,
  postIds: string[],
) {
  const result = new Map<string, ContentListingDto>();

  if (postIds.length === 0) {
    return result;
  }

  const rows = await executor
    .select({
      postId: listings.postId,
      type: listings.type,
      condition: listings.condition,
      price: listings.price,
    })
    .from(listings)
    .where(inArray(listings.postId, postIds));

  for (const row of rows) {
    result.set(row.postId, {
      type: row.type,
      condition: row.condition,
      price: row.price,
    });
  }

  return result;
}

async function selectPostPolls(
  executor: ContentReadExecutor,
  postIds: string[],
  viewerId: string,
) {
  const result = new Map<string, PollView>();

  if (postIds.length === 0) {
    return result;
  }

  const voteCount = sql<number>`(
    select count(*)::int
    from ${pollVotes}
    where ${pollVotes.optionId} = ${pollOptions.id}
  )`;
  const selected = sql<boolean>`exists (
    select 1
    from ${pollVotes}
    where ${pollVotes.pollId} = ${pollOptions.pollId}
      and ${pollVotes.userId} = ${viewerId}
      and ${pollVotes.optionId} = ${pollOptions.id}
  )`;
  const rows = await executor
    .select({
      pollId: polls.postId,
      optionId: pollOptions.id,
      text: pollOptions.text,
      position: pollOptions.position,
      voteCount,
      selected,
    })
    .from(polls)
    .innerJoin(pollOptions, eq(pollOptions.pollId, polls.postId))
    .where(inArray(polls.postId, postIds))
    .orderBy(asc(polls.postId), asc(pollOptions.position));

  for (const row of rows) {
    let pollView = result.get(row.pollId);

    if (!pollView) {
      pollView = {
        poll: { id: row.pollId, totalVotes: 0, options: [] },
        selectedOptionId: null,
      };
      result.set(row.pollId, pollView);
    }

    const optionVotes = Number(row.voteCount);
    pollView.poll.options.push({
      id: row.optionId,
      text: row.text,
      voteCount: optionVotes,
    });
    pollView.poll.totalVotes += optionVotes;

    if (row.selected) {
      pollView.selectedOptionId = row.optionId;
    }
  }

  return result;
}

function serializeComment(
  row: CommentRow,
  viewerId: string,
): ContentCommentDto {
  const isDeleted = row.deletedAt !== null;
  const isAuthorDeleted = row.authorDeletedAt !== null;
  const isAuthor = row.authorId === viewerId;

  return {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    isAnonymous: row.isAnonymous,
    isDeleted,
    body: isDeleted ? null : row.body,
    author: isDeleted || isAuthorDeleted
      ? deletedAuthor()
      : row.isAnonymous
        ? anonymousAuthor()
        : visibleAuthor({
            id: row.authorId,
            username: row.username,
            displayName: row.displayName,
          }),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    gif: isDeleted ? null : gifFromRow(row),
    likeCount: Number(row.likeCount),
    replyCount: Number(row.replyCount),
    viewerState: {
      isAuthor,
      canEdit: isAuthor && !isDeleted,
      canDelete: isAuthor && !isDeleted,
      liked: row.liked,
    },
  };
}

async function selectPost(
  executor: ContentReadExecutor,
  postId: string,
  viewerId: string,
): Promise<PostRow | null> {
  const commentCount = sql<number>`count(${comments.id})::int`;
  const likeCount = sql<number>`(
    select count(*)::int
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
  )`;
  const liked = sql<boolean>`exists (
    select 1
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
      and ${postLikes.userId} = ${viewerId}
  )`;
  const bookmarked = sql<boolean>`exists (
    select 1
    from ${postBookmarks}
    where ${postBookmarks.postId} = ${posts.id}
      and ${postBookmarks.userId} = ${viewerId}
  )`;
  const [row] = await executor
    .select({
      id: posts.id,
      authorId: posts.authorId,
      category: posts.category,
      isAnonymous: posts.isAnonymous,
      title: posts.title,
      body: posts.body,
      gifId: posts.gifId,
      gifUrl: posts.gifUrl,
      gifWidth: posts.gifWidth,
      gifHeight: posts.gifHeight,
      gifAlt: posts.gifAlt,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      hiddenAt: posts.hiddenAt,
      username: users.username,
      displayName: users.displayName,
      commentCount,
      likeCount,
      liked,
      bookmarked,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(
      comments,
      and(
        eq(comments.postId, posts.id),
        isNull(comments.deletedAt),
        commentVisibleToViewer(viewerId),
      ),
    )
    .where(
      and(
        eq(posts.id, postId),
        postVisibleToViewer(viewerId),
      ),
    )
    .groupBy(posts.id, users.id)
    .limit(1);

  return row ?? null;
}

async function selectPostComments(
  executor: ContentReadExecutor,
  postId: string,
  viewerId: string,
): Promise<CommentRow[]> {
  return executor
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      isAnonymous: comments.isAnonymous,
      body: comments.body,
      gifId: comments.gifId,
      gifUrl: comments.gifUrl,
      gifWidth: comments.gifWidth,
      gifHeight: comments.gifHeight,
      gifAlt: comments.gifAlt,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      username: users.username,
      displayName: users.displayName,
      authorDeletedAt: users.deletedAt,
      likeCount: sql<number>`(
        select count(*)::int from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id}
      )`,
      replyCount: sql<number>`(
        select count(*)::int from comments as replies
        where replies.parent_id = ${comments.id}
          and replies.deleted_at is null
      )`,
      liked: sql<boolean>`exists (
        select 1 from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id}
          and ${commentLikes.userId} = ${viewerId}
      )`,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(
      and(
        eq(comments.postId, postId),
        commentVisibleToViewer(viewerId),
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

export async function listContentPosts(
  viewerId: string,
  query: FeedQueryInput,
) {
  const cursor = query.cursor
    ? decodeFeedCursor(query.cursor, query)
    : null;
  const trendingAnchorDate =
    query.sort === "trending"
      ? (cursor?.trendingAnchorDate ?? getCampusDateKey(new Date()))
      : null;

  if (query.sort === "trending" && !trendingAnchorDate) {
    throw invalidCursorError();
  }

  const filters: SQL[] = [
    postVisibleToViewer(viewerId),
  ];
  const likeCount = sql<number>`(
    select count(*)::int
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
  )`;
  // Aynı gün içindeki sıralama: yorum 4, beğeni 2, anket oyu 1 puan.
  // Skaler alt sorgular cursor karşılaştırması ile ana sorgu sırasının birebir
  // aynı kalmasını sağlar.
  const trendingScore = sql<number>`(
    (
      select count(*)::int
      from ${postLikes}
      where ${postLikes.postId} = ${posts.id}
    ) * ${CAMPUS_TRENDING_LIKE_WEIGHT} + (
      select count(*)::int
      from ${comments}
      where ${comments.postId} = ${posts.id}
        and ${comments.deletedAt} is null
        and ${commentVisibleToViewer(viewerId)}
    ) * ${CAMPUS_TRENDING_COMMENT_WEIGHT} + (
      select count(*)::int
      from ${pollVotes}
      where ${pollVotes.pollId} = ${posts.id}
    ) * ${CAMPUS_TRENDING_POLL_VOTE_WEIGHT}
  )`;
  const campusPostDate = sql`timezone(${CAMPUS_TIME_ZONE}, ${posts.createdAt})::date`;
  const anchorDate = sql`cast(${trendingAnchorDate} as date)`;
  const trendingDayRank =
    query.sort === "trending"
      ? sql<number>`(
          ${CAMPUS_TRENDING_WINDOW_DAYS - 1} -
          (${anchorDate} - ${campusPostDate})
        )::int`
      : sql<number>`0`;
  const feedRank = query.sort === "trending" ? trendingScore : likeCount;

  if (query.q) {
    filters.push(postSearchFilter(query.q));
  }

  if (query.sort === "trending") {
    filters.push(
      sql`${campusPostDate} between
        (${anchorDate} - ${sql.raw(
          String(CAMPUS_TRENDING_WINDOW_DAYS - 1),
        )})
        and ${anchorDate}`,
    );
  }

  if (query.category) {
    filters.push(eq(posts.category, query.category));
  }

  if (query.hasDocument) {
    filters.push(
      exists(
        getDatabase()
          .select({ postId: postDocuments.postId })
          .from(postDocuments)
          .where(eq(postDocuments.postId, posts.id)),
      ),
    );
  }

  if (query.author) {
    filters.push(
      eq(users.username, query.author),
      eq(posts.isAnonymous, false),
    );
  }

  if (query.scope === "following") {
    // Takip akışı yalnızca takip edilenleri gösterir; kendi gönderilerin
    // burada değil, profilinde ve genel akışta görünür.
    filters.push(
      exists(
        getDatabase()
          .select({ followerId: follows.followerId })
          .from(follows)
          .where(
            and(
              eq(follows.followerId, viewerId),
              eq(follows.followingId, posts.authorId),
            ),
          ),
      ),
    );
  }

  if (cursor) {
    let cursorFilter: SQL | undefined;

    if (query.sort === "trending") {
      if (cursor.rank === null || cursor.trendingDayRank === null) {
        throw invalidCursorError();
      }

      cursorFilter = or(
        lt(trendingDayRank, cursor.trendingDayRank),
        and(
          eq(trendingDayRank, cursor.trendingDayRank),
          lt(trendingScore, cursor.rank),
        ),
        and(
          eq(trendingDayRank, cursor.trendingDayRank),
          eq(trendingScore, cursor.rank),
          lt(posts.createdAt, cursor.createdAt),
        ),
        and(
          eq(trendingDayRank, cursor.trendingDayRank),
          eq(trendingScore, cursor.rank),
          eq(posts.createdAt, cursor.createdAt),
          lt(posts.id, cursor.id),
        ),
      );
    } else if (cursor.rank !== null) {
      cursorFilter = or(
        lt(feedRank, cursor.rank),
        and(
          eq(feedRank, cursor.rank),
          lt(posts.createdAt, cursor.createdAt),
        ),
        and(
          eq(feedRank, cursor.rank),
          eq(posts.createdAt, cursor.createdAt),
          lt(posts.id, cursor.id),
        ),
      );
    } else {
      cursorFilter = or(
        lt(posts.createdAt, cursor.createdAt),
        and(
          eq(posts.createdAt, cursor.createdAt),
          lt(posts.id, cursor.id),
        ),
      );
    }

    if (cursorFilter) {
      filters.push(cursorFilter);
    }
  }

  const commentCount = sql<number>`count(${comments.id})::int`;
  const liked = sql<boolean>`exists (
    select 1
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
      and ${postLikes.userId} = ${viewerId}
  )`;
  const bookmarked = sql<boolean>`exists (
    select 1
    from ${postBookmarks}
    where ${postBookmarks.postId} = ${posts.id}
      and ${postBookmarks.userId} = ${viewerId}
  )`;
  const database = getDatabase();
  const rows = await database
    .select({
      id: posts.id,
      authorId: posts.authorId,
      category: posts.category,
      isAnonymous: posts.isAnonymous,
      title: posts.title,
      body: posts.body,
      gifId: posts.gifId,
      gifUrl: posts.gifUrl,
      gifWidth: posts.gifWidth,
      gifHeight: posts.gifHeight,
      gifAlt: posts.gifAlt,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      hiddenAt: posts.hiddenAt,
      username: users.username,
      displayName: users.displayName,
      commentCount,
      likeCount,
      trendingScore,
      trendingDayRank,
      liked,
      bookmarked,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(
      comments,
      and(
        eq(comments.postId, posts.id),
        isNull(comments.deletedAt),
        // Sayaç, görüntüleyenin gerçekten görebildiği yorumları saymalı.
        commentVisibleToViewer(viewerId),
      ),
    )
    .where(and(...filters))
    .groupBy(posts.id, users.id)
    .orderBy(
      ...(query.sort === "newest"
        ? [desc(posts.createdAt), desc(posts.id)]
        : query.sort === "trending"
          ? [
              desc(trendingDayRank),
              desc(trendingScore),
              desc(posts.createdAt),
              desc(posts.id),
            ]
          : [desc(likeCount), desc(posts.createdAt), desc(posts.id)]),
    )
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const visibleRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = visibleRows.at(-1);
  const visiblePostIds = visibleRows.map((row) => row.id);
  const [pollViews, listingViews, imageViews, documentViews] =
    await Promise.all([
      selectPostPolls(database, visiblePostIds, viewerId),
      selectPostListings(database, visiblePostIds),
      selectPostImages(database, visiblePostIds),
      selectPostDocuments(database, visiblePostIds),
    ]);

  return {
    data: visibleRows.map((row) =>
      serializePost(
        row,
        viewerId,
        pollViews.get(row.id),
        listingViews.get(row.id),
        imageViews.get(row.id),
        documentViews.get(row.id),
      ),
    ),
    page: {
      nextCursor:
        hasMore && lastVisibleRow
          ? encodeFeedCursor(lastVisibleRow, query, trendingAnchorDate)
          : null,
      hasMore,
    },
  };
}

export async function listContentBookmarks(
  viewerId: string,
  query: BookmarksQueryInput,
) {
  const filters: SQL[] = [
    eq(postBookmarks.userId, viewerId),
    postVisibleToViewer(viewerId),
  ];

  if (query.cursor) {
    const cursor = decodeBookmarkCursor(query.cursor);
    const cursorFilter = or(
      lt(postBookmarks.createdAt, cursor.bookmarkedAt),
      and(
        eq(postBookmarks.createdAt, cursor.bookmarkedAt),
        lt(posts.id, cursor.postId),
      ),
    );

    if (cursorFilter) {
      filters.push(cursorFilter);
    }
  }

  const commentCount = sql<number>`count(${comments.id})::int`;
  const likeCount = sql<number>`(
    select count(*)::int
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
  )`;
  const liked = sql<boolean>`exists (
    select 1
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
      and ${postLikes.userId} = ${viewerId}
  )`;
  const database = getDatabase();
  const rows = await database
    .select({
      id: posts.id,
      authorId: posts.authorId,
      category: posts.category,
      isAnonymous: posts.isAnonymous,
      title: posts.title,
      body: posts.body,
      gifId: posts.gifId,
      gifUrl: posts.gifUrl,
      gifWidth: posts.gifWidth,
      gifHeight: posts.gifHeight,
      gifAlt: posts.gifAlt,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      hiddenAt: posts.hiddenAt,
      username: users.username,
      displayName: users.displayName,
      bookmarkedAt: postBookmarks.createdAt,
      commentCount,
      likeCount,
      liked,
      // The join already restricts rows to bookmarks owned by the viewer.
      bookmarked: sql<boolean>`true`,
    })
    .from(postBookmarks)
    .innerJoin(posts, eq(posts.id, postBookmarks.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(
      comments,
      and(
        eq(comments.postId, posts.id),
        isNull(comments.deletedAt),
        // Sayaç, görüntüleyenin gerçekten görebildiği yorumları saymalı.
        commentVisibleToViewer(viewerId),
      ),
    )
    .where(and(...filters))
    .groupBy(posts.id, users.id, postBookmarks.createdAt)
    .orderBy(desc(postBookmarks.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const visibleRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = visibleRows.at(-1);
  const visiblePostIds = visibleRows.map((row) => row.id);
  const [pollViews, listingViews, imageViews, documentViews] =
    await Promise.all([
      selectPostPolls(database, visiblePostIds, viewerId),
      selectPostListings(database, visiblePostIds),
      selectPostImages(database, visiblePostIds),
      selectPostDocuments(database, visiblePostIds),
    ]);

  return {
    data: visibleRows.map((row) =>
      serializePost(
        row,
        viewerId,
        pollViews.get(row.id),
        listingViews.get(row.id),
        imageViews.get(row.id),
        documentViews.get(row.id),
      ),
    ),
    page: {
      nextCursor:
        hasMore && lastVisibleRow
          ? encodeBookmarkCursor(lastVisibleRow)
          : null,
      hasMore,
    },
  };
}

export async function getContentPost(
  viewerId: string,
  postId: string,
): Promise<ContentPostDetailDto> {
  assertUuid(postId, postNotFoundError);

  return getDatabase().transaction(
    async (transaction) => {
      const post = await selectPost(transaction, postId, viewerId);

      if (!post) {
        throw postNotFoundError();
      }

      const commentRows = await selectPostComments(
        transaction,
        postId,
        viewerId,
      );
      const [pollViews, listingViews, imageViews, documentViews] =
        await Promise.all([
          selectPostPolls(transaction, [postId], viewerId),
          selectPostListings(transaction, [postId]),
          selectPostImages(transaction, [postId]),
          selectPostDocuments(transaction, [postId]),
        ]);

      return {
        ...serializePost(
          post,
          viewerId,
          pollViews.get(postId),
          listingViews.get(postId),
          imageViews.get(postId),
          documentViews.get(postId),
        ),
        comments: commentRows.map((comment) =>
          serializeComment(comment, viewerId),
        ),
      };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}

export async function setContentPostLike(
  viewerId: string,
  postId: string,
  liked: boolean,
): Promise<ContentPostDto> {
  assertUuid(postId, postNotFoundError);

  return getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);
    await consumeRateLimit(transaction, viewerId, "interaction");
    const activePost = await assertActivePostForInteraction(
      transaction,
      postId,
      viewerId,
    );

    if (liked) {
      const inserted = await transaction
        .insert(postLikes)
        .values({ postId, userId: viewerId })
        .onConflictDoNothing()
        .returning({ postId: postLikes.postId });

      if (inserted.length > 0) {
        await recordLikeNotification(transaction, {
          recipientId: activePost.authorId,
          actorId: viewerId,
          postId,
        });
      }
    } else {
      await transaction
        .delete(postLikes)
        .where(
          and(
            eq(postLikes.postId, postId),
            eq(postLikes.userId, viewerId),
          ),
        );
    }

    const post = await selectPost(transaction, postId, viewerId);

    if (!post) {
      throw postNotFoundError();
    }

    const [pollViews, listingViews, imageViews, documentViews] =
      await Promise.all([
        selectPostPolls(transaction, [postId], viewerId),
        selectPostListings(transaction, [postId]),
        selectPostImages(transaction, [postId]),
        selectPostDocuments(transaction, [postId]),
      ]);
    return serializePost(
      post,
      viewerId,
      pollViews.get(postId),
      listingViews.get(postId),
      imageViews.get(postId),
      documentViews.get(postId),
    );
  });
}

export async function setContentPostBookmark(
  viewerId: string,
  postId: string,
  bookmarked: boolean,
): Promise<ContentPostDto> {
  assertUuid(postId, postNotFoundError);

  return getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);
    await consumeRateLimit(transaction, viewerId, "interaction");
    await assertActivePostForInteraction(transaction, postId, viewerId);

    if (bookmarked) {
      await transaction
        .insert(postBookmarks)
        .values({ postId, userId: viewerId })
        .onConflictDoNothing();
    } else {
      await transaction
        .delete(postBookmarks)
        .where(
          and(
            eq(postBookmarks.postId, postId),
            eq(postBookmarks.userId, viewerId),
          ),
        );
    }

    const post = await selectPost(transaction, postId, viewerId);

    if (!post) {
      throw postNotFoundError();
    }

    const [pollViews, listingViews, imageViews, documentViews] =
      await Promise.all([
        selectPostPolls(transaction, [postId], viewerId),
        selectPostListings(transaction, [postId]),
        selectPostImages(transaction, [postId]),
        selectPostDocuments(transaction, [postId]),
      ]);
    return serializePost(
      post,
      viewerId,
      pollViews.get(postId),
      listingViews.get(postId),
      imageViews.get(postId),
      documentViews.get(postId),
    );
  });
}

export async function createContentPost(
  viewerId: string,
  input: CreatePostInput,
) {
  const gif = input.gifId ? await resolveGiphyGif(input.gifId) : null;
  const created = await getDatabase().transaction(
    async (transaction) => {
      await assertActiveContentMember(transaction, viewerId);
      await consumeRateLimit(transaction, viewerId, "post_create");

      if (input.imageId) {
        const [ownedImage] = await transaction
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.id, input.imageId),
              eq(mediaAssets.ownerId, viewerId),
            ),
          )
          .for("update")
          .limit(1);

        const [existingLink] = await transaction
          .select({ postId: postImages.postId })
          .from(postImages)
          .where(eq(postImages.assetId, input.imageId))
          .limit(1);

        if (!ownedImage || existingLink) {
          throw new AuthError(
            "INVALID_REQUEST",
            "Bu görsel gönderiye eklenemiyor. Lütfen yeniden yükle.",
            {
              fieldErrors: {
                imageId: ["Görsel bulunamadı veya başka bir gönderide kullanılıyor."],
              },
              status: 400,
            },
          );
        }
      }

      if (input.documentId) {
        const [ownedDocument] = await transaction
          .select({ id: documentAssets.id })
          .from(documentAssets)
          .where(
            and(
              eq(documentAssets.id, input.documentId),
              eq(documentAssets.ownerId, viewerId),
            ),
          )
          .for("update")
          .limit(1);

        const [existingDocumentLink] = await transaction
          .select({ postId: postDocuments.postId })
          .from(postDocuments)
          .where(eq(postDocuments.assetId, input.documentId))
          .limit(1);

        if (!ownedDocument || existingDocumentLink) {
          throw new AuthError(
            "INVALID_REQUEST",
            "Bu doküman gönderiye eklenemiyor. Lütfen yeniden yükle.",
            {
              fieldErrors: {
                documentId: [
                  "Doküman bulunamadı veya başka bir gönderide kullanılıyor.",
                ],
              },
              status: 400,
            },
          );
        }
      }

      const [inserted] = await transaction
        .insert(posts)
        .values({
          authorId: viewerId,
          category: input.category,
          isAnonymous: input.isAnonymous,
          title: input.title,
          body: input.body,
          gifId: gif?.id,
          gifUrl: gif?.src,
          gifWidth: gif?.width,
          gifHeight: gif?.height,
          gifAlt: gif?.alt,
        })
        .returning({ id: posts.id });

      if (inserted && input.category === "poll" && input.pollOptions) {
        await transaction.insert(polls).values({ postId: inserted.id });
        await transaction.insert(pollOptions).values(
          input.pollOptions.map((text, position) => ({
            pollId: inserted.id,
            text,
            position,
          })),
        );
      }

      if (inserted && input.category === "listing" && input.listing) {
        await transaction.insert(listings).values({
          postId: inserted.id,
          type: input.listing.type,
          condition: input.listing.condition,
          price: input.listing.price,
        });
      }

      if (inserted && input.imageId) {
        const alt = input.title
          ? `${input.title} görseli`.slice(0, 160)
          : "Kampüs gönderisi görseli";

        await transaction.insert(postImages).values({
          postId: inserted.id,
          assetId: input.imageId,
          alt,
        });
      }

      if (inserted && input.documentId) {
        await transaction.insert(postDocuments).values({
          postId: inserted.id,
          assetId: input.documentId,
        });
      }

      return inserted;
    },
  );

  if (!created) {
    throw new AuthError(
      "AUTH_CONFIGURATION_ERROR",
      "Gönderi şu anda oluşturulamıyor. Lütfen yeniden dene.",
      { status: 500 },
    );
  }

  return getContentPost(viewerId, created.id);
}

export async function voteInContentPoll(
  viewerId: string,
  pollId: string,
  optionId: string,
): Promise<ContentPostDto> {
  assertUuid(pollId, postNotFoundError);
  assertUuid(optionId, postNotFoundError);

  return getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);
    await consumeRateLimit(transaction, viewerId, "interaction");
    await assertActivePostForInteraction(transaction, pollId, viewerId);

    const [option] = await transaction
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .innerJoin(polls, eq(polls.postId, pollOptions.pollId))
      .where(
        and(
          eq(pollOptions.id, optionId),
          eq(pollOptions.pollId, pollId),
        ),
      )
      .for("share")
      .limit(1);

    if (!option) {
      throw postNotFoundError();
    }

    await transaction
      .insert(pollVotes)
      .values({
        pollId,
        userId: viewerId,
        optionId,
      })
      .onConflictDoUpdate({
        target: [pollVotes.pollId, pollVotes.userId],
        set: { optionId, updatedAt: new Date() },
      });

    const post = await selectPost(transaction, pollId, viewerId);

    if (!post) {
      throw postNotFoundError();
    }

    const [pollViews, imageViews] = await Promise.all([
      selectPostPolls(transaction, [pollId], viewerId),
      selectPostImages(transaction, [pollId]),
    ]);

    return serializePost(
      post,
      viewerId,
      pollViews.get(pollId),
      undefined,
      imageViews.get(pollId),
    );
  });
}

export async function updateContentPost(
  viewerId: string,
  postId: string,
  input: UpdatePostInput,
) {
  assertUuid(postId, postNotFoundError);

  await getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);

    const [current] = await transaction
      .select({
        id: posts.id,
        authorId: posts.authorId,
        category: posts.category,
        title: posts.title,
        body: posts.body,
      })
      .from(posts)
      .where(
        and(eq(posts.id, postId), isNull(posts.deletedAt)),
      )
      .for("update")
      .limit(1);

    if (!current) {
      throw postNotFoundError();
    }

    if (current.authorId !== viewerId) {
      throw contentForbiddenError();
    }

    await consumeRateLimit(transaction, viewerId, "content_update");

    const finalContent = validateFinalPostContent(current, input);

    if (
      current.category === "listing" &&
      (!finalContent.title || !finalContent.body)
    ) {
      throw new AuthError(
        "INVALID_REQUEST",
        "İlan başlığı ve açıklaması boş bırakılamaz.",
        {
          fieldErrors: {
            title: finalContent.title ? [] : ["İlan başlığını yazmalısın."],
            body: finalContent.body ? [] : ["İlan açıklamasını yazmalısın."],
          },
          status: 400,
        },
      );
    }

    await transaction
      .update(posts)
      .set({
        title: finalContent.title,
        body: finalContent.body,
        editedAt: new Date(),
      })
      .where(
        and(
          eq(posts.id, postId),
          eq(posts.authorId, viewerId),
          isNull(posts.deletedAt),
        ),
      );
  });

  return getContentPost(viewerId, postId);
}

export async function deleteContentPost(
  viewerId: string,
  postId: string,
) {
  assertUuid(postId, postNotFoundError);
  const deletedAt = new Date();

  const { deletedImageStorageKey, deletedDocumentStorageKey } =
    await getDatabase().transaction(async (transaction) => {
      await assertActiveContentMember(transaction, viewerId);

      const [current] = await transaction
        .select({
          id: posts.id,
          authorId: posts.authorId,
        })
        .from(posts)
        .where(
          and(eq(posts.id, postId), isNull(posts.deletedAt)),
        )
        .for("update")
        .limit(1);

      if (!current) {
        throw postNotFoundError();
      }

      if (current.authorId !== viewerId) {
        throw contentForbiddenError();
      }

      await consumeRateLimit(transaction, viewerId, "content_delete");

      const [attachedImage] = await transaction
        .select({
          assetId: postImages.assetId,
          storageKey: mediaAssets.storageKey,
        })
        .from(postImages)
        .innerJoin(mediaAssets, eq(mediaAssets.id, postImages.assetId))
        .where(eq(postImages.postId, postId))
        .for("update")
        .limit(1);

      if (attachedImage) {
        await transaction
          .delete(postImages)
          .where(eq(postImages.postId, postId));
        await transaction
          .delete(mediaAssets)
          .where(eq(mediaAssets.id, attachedImage.assetId));
      }

      const [attachedDocument] = await transaction
        .select({
          assetId: postDocuments.assetId,
          storageKey: documentAssets.storageKey,
        })
        .from(postDocuments)
        .innerJoin(
          documentAssets,
          eq(documentAssets.id, postDocuments.assetId),
        )
        .where(eq(postDocuments.postId, postId))
        .for("update")
        .limit(1);

      if (attachedDocument) {
        await transaction
          .delete(postDocuments)
          .where(eq(postDocuments.postId, postId));
        await transaction
          .delete(documentAssets)
          .where(eq(documentAssets.id, attachedDocument.assetId));
      }

      await transaction
        .update(posts)
        .set({ deletedAt })
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.authorId, viewerId),
            isNull(posts.deletedAt),
          ),
        );

      return {
        deletedImageStorageKey: attachedImage?.storageKey,
        deletedDocumentStorageKey: attachedDocument?.storageKey,
      };
    });

  if (deletedImageStorageKey) {
    await getMediaStorage()
      .delete(deletedImageStorageKey)
      .catch(() => undefined);
  }

  if (deletedDocumentStorageKey) {
    await getMediaStorage()
      .delete(deletedDocumentStorageKey)
      .catch(() => undefined);
  }

  return {
    id: postId,
    deletedAt: deletedAt.toISOString(),
  };
}

async function selectComment(
  commentId: string,
  viewerId: string,
): Promise<CommentRow | null> {
  const [row] = await getDatabase()
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      isAnonymous: comments.isAnonymous,
      body: comments.body,
      gifId: comments.gifId,
      gifUrl: comments.gifUrl,
      gifWidth: comments.gifWidth,
      gifHeight: comments.gifHeight,
      gifAlt: comments.gifAlt,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      username: users.username,
      displayName: users.displayName,
      authorDeletedAt: users.deletedAt,
      likeCount: sql<number>`(
        select count(*)::int from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id}
      )`,
      replyCount: sql<number>`(
        select count(*)::int from comments as replies
        where replies.parent_id = ${comments.id}
          and replies.deleted_at is null
      )`,
      liked: sql<boolean>`exists (
        select 1 from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id}
          and ${commentLikes.userId} = ${viewerId}
      )`,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(
      and(
        eq(comments.id, commentId),
        postVisibleToViewer(viewerId),
        commentVisibleToViewer(viewerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Yorum beğenisi; gönderi beğenisiyle aynı idempotent desen. */
export async function setContentCommentLike(
  viewerId: string,
  commentId: string,
  liked: boolean,
): Promise<ContentCommentDto> {
  assertUuid(commentId, commentNotFoundError);

  await getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);
    await consumeRateLimit(transaction, viewerId, "interaction");

    const [target] = await transaction
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(
        and(
          eq(comments.id, commentId),
          isNull(comments.deletedAt),
          postVisibleToViewer(viewerId),
          commentInteractableByViewer(viewerId),
        ),
      )
      .for("share")
      .limit(1);

    if (!target) {
      throw commentNotFoundError();
    }

    if (liked) {
      await transaction
        .insert(commentLikes)
        .values({ commentId, userId: viewerId })
        .onConflictDoNothing();
    } else {
      await transaction
        .delete(commentLikes)
        .where(
          and(
            eq(commentLikes.commentId, commentId),
            eq(commentLikes.userId, viewerId),
          ),
        );
    }
  });

  const updated = await selectComment(commentId, viewerId);

  if (!updated) {
    throw commentNotFoundError();
  }

  return serializeComment(updated, viewerId);
}

export async function createContentComment(
  viewerId: string,
  postId: string,
  input: CreateCommentInput,
) {
  assertUuid(postId, postNotFoundError);
  const gif = input.gifId ? await resolveGiphyGif(input.gifId) : null;
  let parentId = input.parentId;

  const createdId = await getDatabase().transaction(
    async (transaction) => {
      await assertActiveContentMember(transaction, viewerId);
      const createdAt = new Date();

      const [activePost] = await transaction
        .select({ id: posts.id, authorId: posts.authorId })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(
          and(
            eq(posts.id, postId),
            postVisibleToViewer(viewerId),
          ),
        )
        .for("share")
        .limit(1);

      if (!activePost) {
        throw postNotFoundError();
      }

      await assertCommentCreationAllowed(
        transaction,
        viewerId,
        postId,
        createdAt,
      );

      let replyRecipientId: string | null = null;

      if (parentId) {
        const [parent] = await transaction
          .select({
            id: comments.id,
            postId: comments.postId,
            parentId: comments.parentId,
            authorId: comments.authorId,
            deletedAt: comments.deletedAt,
          })
          .from(comments)
          .where(
            and(
              eq(comments.id, parentId),
              // Engellenen kullanıcının yorumuna yanıt verilemez.
              commentInteractableByViewer(viewerId),
            ),
          )
          .for("share")
          .limit(1);

        if (
          !parent ||
          parent.deletedAt !== null ||
          parent.postId !== postId
        ) {
          throw new AuthError(
            "INVALID_REQUEST",
            "Yanıtlanan yorum bu gönderide bulunamadı.",
            {
              fieldErrors: {
                parentId: ["Geçerli bir yorum seçip yeniden dene."],
              },
              status: 400,
            },
          );
        }

        replyRecipientId = parent.authorId;
        parentId = parent.parentId ?? parent.id;
      }

      const [created] = await transaction
        .insert(comments)
        .values({
          postId,
          authorId: viewerId,
          parentId,
          isAnonymous: input.isAnonymous,
          body: input.body,
          gifId: gif?.id,
          gifUrl: gif?.src,
          gifWidth: gif?.width,
          gifHeight: gif?.height,
          gifAlt: gif?.alt,
          createdAt,
        })
        .returning({ id: comments.id });

      if (!created) {
        throw new AuthError(
          "AUTH_CONFIGURATION_ERROR",
          "Yorum şu anda oluşturulamıyor. Lütfen yeniden dene.",
          { status: 500 },
        );
      }

      if (replyRecipientId) {
        await recordCommentNotification(transaction, {
          recipientId: replyRecipientId,
          actorId: viewerId,
          postId,
          commentId: created.id,
          kind: "reply",
        });
      } else {
        await recordCommentNotification(transaction, {
          recipientId: activePost.authorId,
          actorId: viewerId,
          postId,
          commentId: created.id,
          kind: "comment",
        });
      }

      await recordMentionNotifications(transaction, {
        actorId: viewerId,
        postId,
        commentId: created.id,
        commentBody: input.body,
      });

      return created.id;
    },
  );

  const createdComment = await selectComment(createdId, viewerId);

  if (!createdComment) {
    throw commentNotFoundError();
  }

  return serializeComment(createdComment, viewerId);
}

export async function updateContentComment(
  viewerId: string,
  commentId: string,
  input: UpdateCommentInput,
) {
  assertUuid(commentId, commentNotFoundError);

  await getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);

    const [current] = await transaction
      .select({
        id: comments.id,
        authorId: comments.authorId,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(
        and(
          eq(comments.id, commentId),
          isNull(comments.deletedAt),
          postVisibleToViewer(viewerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      throw commentNotFoundError();
    }

    if (current.authorId !== viewerId) {
      throw contentForbiddenError();
    }

    await consumeRateLimit(transaction, viewerId, "content_update");

    await transaction
      .update(comments)
      .set({
        body: input.body,
        editedAt: new Date(),
      })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.authorId, viewerId),
          isNull(comments.deletedAt),
        ),
      );
  });

  const updated = await selectComment(commentId, viewerId);

  if (!updated) {
    throw commentNotFoundError();
  }

  return serializeComment(updated, viewerId);
}

export async function deleteContentComment(
  viewerId: string,
  commentId: string,
) {
  assertUuid(commentId, commentNotFoundError);
  const deletedAt = new Date();

  await getDatabase().transaction(async (transaction) => {
    await assertActiveContentMember(transaction, viewerId);

    const [current] = await transaction
      .select({
        id: comments.id,
        authorId: comments.authorId,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(
        and(
          eq(comments.id, commentId),
          isNull(comments.deletedAt),
          postVisibleToViewer(viewerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      throw commentNotFoundError();
    }

    if (current.authorId !== viewerId) {
      throw contentForbiddenError();
    }

    await consumeRateLimit(transaction, viewerId, "content_delete");

    await transaction
      .update(comments)
      .set({ deletedAt })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.authorId, viewerId),
          isNull(comments.deletedAt),
        ),
      );
  });

  return {
    id: commentId,
    deletedAt: deletedAt.toISOString(),
  };
}
