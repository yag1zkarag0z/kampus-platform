import "server-only";

import { Buffer } from "node:buffer";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
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
  ContentPollDto,
  ContentPostDetailDto,
  ContentPostDto,
} from "@/content/types";
import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  comments,
  postBookmarks,
  postLikes,
  pollOptions,
  polls,
  pollVotes,
  posts,
  users,
  type Post,
} from "@/server/db/schema";

import {
  validateFinalPostContent,
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
const CURSOR_VERSION = 2;
const COMMENT_CREATION_MINUTE_LIMIT = 20;
const POST_COMMENT_TOTAL_LIMIT = 500;

type FeedCursor = {
  version: typeof CURSOR_VERSION;
  sort: FeedQueryInput["sort"];
  category: FeedQueryInput["category"] | null;
  author: string | null;
  createdAt: Date;
  id: string;
  likeCount: number | null;
};

type PostRow = {
  id: string;
  authorId: string;
  category: Post["category"];
  isAnonymous: boolean;
  title: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  username: string;
  displayName: string;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
};

type CommentRow = {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  isAnonymous: boolean;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  username: string;
  displayName: string;
  authorDeletedAt: Date | null;
};

type PollView = {
  poll: ContentPollDto;
  selectedOptionId: string | null;
};

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

function contentRateLimitedError() {
  return new AuthError(
    "CONTENT_RATE_LIMITED",
    "Çok kısa sürede fazla yorum gönderdin. Bir dakika sonra yeniden dene.",
    {
      retryAfterSeconds: 60,
      status: 429,
    },
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

function unsupportedPostCategoryError() {
  return new AuthError(
    "INVALID_REQUEST",
    "İlan gönderileri kendi veri yapısı tamamlandıktan sonra paylaşılabilecek.",
    {
      fieldErrors: {
        category: ["İlan dışında bir gönderi kategorisi seç."],
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

async function assertActivePostForInteraction(
  transaction: ContentTransaction,
  postId: string,
) {
  const [activePost] = await transaction
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.id, postId),
        isNull(posts.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .for("share")
    .limit(1);

  if (!activePost) {
    throw postNotFoundError();
  }
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
  await lockContentKeys(transaction, [
    `content-comment-post:${postId}`,
    `content-comment-user:${viewerId}`,
  ]);

  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const [recentUsage, postUsage] = await Promise.all([
    transaction
      .select({ total: count() })
      .from(comments)
      .where(
        and(
          eq(comments.authorId, viewerId),
          gte(comments.createdAt, oneMinuteAgo),
        ),
      ),
    transaction
      .select({ total: count() })
      .from(comments)
      .where(eq(comments.postId, postId)),
  ]);

  if (
    (recentUsage[0]?.total ?? 0) >= COMMENT_CREATION_MINUTE_LIMIT
  ) {
    throw contentRateLimitedError();
  }

  if ((postUsage[0]?.total ?? 0) >= POST_COMMENT_TOTAL_LIMIT) {
    throw contentLimitReachedError();
  }
}

function encodeFeedCursor(
  row: Pick<PostRow, "createdAt" | "id" | "likeCount">,
  query: Pick<FeedQueryInput, "author" | "category" | "sort">,
) {
  return Buffer.from(
    JSON.stringify({
      version: CURSOR_VERSION,
      sort: query.sort,
      category: query.category ?? null,
      author: query.author ?? null,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      likeCount: query.sort === "popular" ? Number(row.likeCount) : null,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeFeedCursor(
  value: string,
  query: Pick<FeedQueryInput, "author" | "category" | "sort">,
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
      (decoded.sort !== "newest" && decoded.sort !== "popular") ||
      !("category" in decoded) ||
      (decoded.category !== null &&
        typeof decoded.category !== "string") ||
      !("author" in decoded) ||
      (decoded.author !== null && typeof decoded.author !== "string") ||
      !("createdAt" in decoded) ||
      typeof decoded.createdAt !== "string" ||
      !("id" in decoded) ||
      typeof decoded.id !== "string" ||
      !UUID_PATTERN.test(decoded.id) ||
      !("likeCount" in decoded) ||
      (decoded.likeCount !== null &&
        (typeof decoded.likeCount !== "number" ||
          !Number.isSafeInteger(decoded.likeCount) ||
          decoded.likeCount < 0))
    ) {
      throw invalidCursorError();
    }

    if (
      decoded.category !== (query.category ?? null) ||
      decoded.author !== (query.author ?? null) ||
      decoded.sort !== query.sort ||
      (query.sort === "newest" && decoded.likeCount !== null) ||
      (query.sort === "popular" && decoded.likeCount === null)
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
      author: decoded.author,
      createdAt,
      id: decoded.id,
      likeCount: decoded.likeCount,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw invalidCursorError();
  }
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
    viewerState: {
      isAuthor: row.authorId === viewerId,
      canEdit: row.authorId === viewerId,
      canDelete: row.authorId === viewerId,
      liked: row.liked,
      bookmarked: row.bookmarked,
      selectedPollOptionId: pollView?.selectedOptionId ?? null,
    },
  };
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
    viewerState: {
      isAuthor,
      canEdit: isAuthor && !isDeleted,
      canDelete: isAuthor && !isDeleted,
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
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
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
      ),
    )
    .where(
      and(
        eq(posts.id, postId),
        isNull(posts.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .groupBy(posts.id, users.id)
    .limit(1);

  return row ?? null;
}

async function selectPostComments(
  executor: ContentReadExecutor,
  postId: string,
): Promise<CommentRow[]> {
  return executor
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      isAnonymous: comments.isAnonymous,
      body: comments.body,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      username: users.username,
      displayName: users.displayName,
      authorDeletedAt: users.deletedAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

export async function listContentPosts(
  viewerId: string,
  query: FeedQueryInput,
) {
  const filters: SQL[] = [
    isNull(posts.deletedAt),
    isNull(users.deletedAt),
  ];
  const likeCount = sql<number>`(
    select count(*)::int
    from ${postLikes}
    where ${postLikes.postId} = ${posts.id}
  )`;

  if (query.category) {
    filters.push(eq(posts.category, query.category));
  }

  if (query.author) {
    filters.push(
      eq(users.username, query.author),
      eq(posts.isAnonymous, false),
    );
  }

  if (query.cursor) {
    const cursor = decodeFeedCursor(query.cursor, query);
    const cursorFilter = query.sort === "popular"
      ? or(
          lt(likeCount, cursor.likeCount!),
          and(
            eq(likeCount, cursor.likeCount!),
            lt(posts.createdAt, cursor.createdAt),
          ),
          and(
            eq(likeCount, cursor.likeCount!),
            eq(posts.createdAt, cursor.createdAt),
            lt(posts.id, cursor.id),
          ),
        )
      : or(
          lt(posts.createdAt, cursor.createdAt),
          and(
            eq(posts.createdAt, cursor.createdAt),
            lt(posts.id, cursor.id),
          ),
        );

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
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
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
      ),
    )
    .where(and(...filters))
    .groupBy(posts.id, users.id)
    .orderBy(
      ...(query.sort === "popular"
        ? [desc(likeCount), desc(posts.createdAt), desc(posts.id)]
        : [desc(posts.createdAt), desc(posts.id)]),
    )
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const visibleRows = hasMore ? rows.slice(0, query.limit) : rows;
  const lastVisibleRow = visibleRows.at(-1);
  const pollViews = await selectPostPolls(
    database,
    visibleRows.map((row) => row.id),
    viewerId,
  );

  return {
    data: visibleRows.map((row) =>
      serializePost(row, viewerId, pollViews.get(row.id)),
    ),
    page: {
      nextCursor:
        hasMore && lastVisibleRow
          ? encodeFeedCursor(lastVisibleRow, query)
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
      );
      const pollViews = await selectPostPolls(
        transaction,
        [postId],
        viewerId,
      );

      return {
        ...serializePost(post, viewerId, pollViews.get(postId)),
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
    await assertActivePostForInteraction(transaction, postId);

    if (liked) {
      await transaction
        .insert(postLikes)
        .values({ postId, userId: viewerId })
        .onConflictDoNothing();
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

    const pollViews = await selectPostPolls(
      transaction,
      [postId],
      viewerId,
    );
    return serializePost(post, viewerId, pollViews.get(postId));
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
    await assertActivePostForInteraction(transaction, postId);

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

    const pollViews = await selectPostPolls(
      transaction,
      [postId],
      viewerId,
    );
    return serializePost(post, viewerId, pollViews.get(postId));
  });
}

export async function createContentPost(
  viewerId: string,
  input: CreatePostInput,
) {
  if (input.category === "listing") {
    throw unsupportedPostCategoryError();
  }

  const created = await getDatabase().transaction(
    async (transaction) => {
      await assertActiveContentMember(transaction, viewerId);

      const [inserted] = await transaction
        .insert(posts)
        .values({
          authorId: viewerId,
          category: input.category,
          isAnonymous: input.isAnonymous,
          title: input.title,
          body: input.body,
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
    await assertActivePostForInteraction(transaction, pollId);

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

    const pollViews = await selectPostPolls(
      transaction,
      [pollId],
      viewerId,
    );

    return serializePost(post, viewerId, pollViews.get(pollId));
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

    const finalContent = validateFinalPostContent(current, input);

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
  });

  return {
    id: postId,
    deletedAt: deletedAt.toISOString(),
  };
}

async function selectComment(
  commentId: string,
): Promise<CommentRow | null> {
  const [row] = await getDatabase()
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      isAnonymous: comments.isAnonymous,
      body: comments.body,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      username: users.username,
      displayName: users.displayName,
      authorDeletedAt: users.deletedAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.id, commentId))
    .limit(1);

  return row ?? null;
}

export async function createContentComment(
  viewerId: string,
  postId: string,
  input: CreateCommentInput,
) {
  assertUuid(postId, postNotFoundError);
  let parentId = input.parentId;

  const createdId = await getDatabase().transaction(
    async (transaction) => {
      await assertActiveContentMember(transaction, viewerId);
      const createdAt = new Date();

      const [activePost] = await transaction
        .select({ id: posts.id })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(
          and(
            eq(posts.id, postId),
            isNull(posts.deletedAt),
            isNull(users.deletedAt),
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

      if (parentId) {
        const [parent] = await transaction
          .select({
            id: comments.id,
            postId: comments.postId,
            parentId: comments.parentId,
            deletedAt: comments.deletedAt,
          })
          .from(comments)
          .where(eq(comments.id, parentId))
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

      return created.id;
    },
  );

  const createdComment = await selectComment(createdId);

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
          isNull(posts.deletedAt),
          isNull(users.deletedAt),
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

  const updated = await selectComment(commentId);

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
          isNull(posts.deletedAt),
          isNull(users.deletedAt),
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
