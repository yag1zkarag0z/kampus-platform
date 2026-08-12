import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  notExists,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { blocks, follows, users } from "@/server/db/schema";
import { recordFollowNotification } from "@/server/notifications/service";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  buildCursorPage,
  decodeTimelineCursor,
} from "@/server/pagination/cursor";
import { hasBlockBetween, noBlockBetween } from "@/server/social/blocking";

const FOLLOW_LIST_LIMIT = 200;
const SUGGESTION_LIMIT = 8;
export const SUGGESTION_MAX_LIMIT = 20;
const MEMBER_SEARCH_LIMIT = 8;
/** Bu süreden yeni hesaplar öneri kartında "yeni katıldı" olarak işaretlenir. */
const NEW_MEMBER_WINDOW_DAYS = 14;
/** Rozet metni "X ve N kişi" biçiminde; ikiden fazla ada yer yok. */
const MUTUAL_NAME_LIMIT = 2;

export type FollowSummary = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  blockedByViewer: boolean;
};

export type FollowMemberSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Öneri kartı "neden bu kişi" sorusunu yanıtlamak zorunda; aksi hâlde liste
 * rastgele isimler yığınına dönüyor. Sunucu ham sinyalleri döner, rozet metnini
 * arayüz kurar.
 */
export type SuggestedMemberSummary = FollowMemberSummary & {
  department: string;
  bio: string;
  followerCount: number;
  mutualCount: number;
  mutualNames: string[];
  isNewMember: boolean;
};

function normalizeMemberSearchQuery(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

function userNotFoundError() {
  return new AuthError(
    "USER_NOT_FOUND",
    "Bu kullanıcı adıyla görüntülenebilecek bir profil bulunamadı.",
    { status: 404 },
  );
}

function selfFollowError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Kendini takip edemezsin.",
    { status: 400 },
  );
}

function blockedFollowError() {
  return new AuthError(
    "CONTENT_FORBIDDEN",
    "Bu kullanıcıyı takip edemezsin.",
    { status: 403 },
  );
}

async function assertNotBlocked(userId: string, otherUserId: string) {
  if (await hasBlockBetween(getDatabase(), userId, otherUserId)) {
    throw blockedFollowError();
  }
}

async function resolveActiveUserId(username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  const [user] = await getDatabase()
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.username, normalizedUsername),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) {
    throw userNotFoundError();
  }

  return user.id;
}

/**
 * Engelin iki yönü farklı davranır:
 *
 * - Görüntüleyen karşı tarafı engellediyse profil açılır ama içerik gizlenir;
 *   bu kendi kararı olduğu için saklamak yalnızca kafa karıştırır.
 * - Karşı taraf görüntüleyeni engellediyse profilin varlığı bile sızmamalı,
 *   yoksa "seni kim engelledi" bilgisi taciz için kullanılabilir.
 */
async function resolveProfileTarget(viewerId: string, username: string) {
  const targetId = await resolveActiveUserId(username);

  if (targetId === viewerId) {
    return { id: targetId, blockedByViewer: false };
  }

  const [edge] = await getDatabase()
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(
          eq(blocks.blockerId, viewerId),
          eq(blocks.blockedId, targetId),
        ),
        and(
          eq(blocks.blockerId, targetId),
          eq(blocks.blockedId, viewerId),
        ),
      ),
    )
    .limit(1);

  if (!edge) {
    return { id: targetId, blockedByViewer: false };
  }

  if (edge.blockerId === viewerId) {
    return { id: targetId, blockedByViewer: true };
  }

  throw userNotFoundError();
}

function toFollowMemberSummary(row: {
  id: string;
  username: string;
  displayName: string;
  avatarObjectKey: string | null;
}): FollowMemberSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarObjectKey
      ? `/v1/users/${row.username}/avatar`
      : null,
  };
}

export async function searchMembers(
  viewerId: string,
  value: string,
  limit = MEMBER_SEARCH_LIMIT,
): Promise<FollowMemberSummary[]> {
  const query = normalizeMemberSearchQuery(value);

  if (query.length < 2) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const escapedQuery = escapeLikePattern(query);
  const prefixPattern = `${escapedQuery}%`;
  const containsPattern = `%${escapedQuery}%`;
  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
    })
    .from(users)
    .where(
      and(
        ne(users.id, viewerId),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        noBlockBetween(viewerId, users.id),
        or(
          sql`${users.username}::text ilike ${prefixPattern} escape '\\'`,
          sql`${users.displayName} ilike ${containsPattern} escape '\\'`,
        ),
      ),
    )
    .orderBy(
      sql`case
        when lower(${users.username}::text) = lower(${query}) then 0
        when ${users.username}::text ilike ${prefixPattern} escape '\\' then 1
        when ${users.displayName} ilike ${prefixPattern} escape '\\' then 2
        else 3
      end`,
      asc(users.username),
    )
    .limit(safeLimit);

  return rows.map(toFollowMemberSummary);
}

export async function followUser(
  followerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  if (targetId === followerId) {
    throw selfFollowError();
  }

  await assertNotBlocked(followerId, targetId);

  // Zaten takip ediliyorsa yeni bir kenar oluşmaz; çağıran taraf bunu bilmeli
  // ki ölçüm tekrar tıklamayı yeni takip gibi saymasın.
  return await getDatabase().transaction(async (transaction) => {
    // Takip geri alınabildiği için follows tablosunu saymak sınırı
    // uygulamaya yetmez; ayrı sayaç kullanılıyor.
    await consumeRateLimit(transaction, followerId, "follow");

    const inserted = await transaction
      .insert(follows)
      .values({ followerId, followingId: targetId })
      .onConflictDoNothing()
      .returning({ followerId: follows.followerId });

    if (inserted.length > 0) {
      await recordFollowNotification(transaction, {
        recipientId: targetId,
        actorId: followerId,
      });
    }

    return inserted.length > 0;
  });
}

export async function unfollowUser(
  followerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  await getDatabase().transaction(async (transaction) => {
    await consumeRateLimit(transaction, followerId, "follow");
    await transaction
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, targetId),
        ),
      );
  });
}

export async function getFollowSummary(
  viewerId: string,
  username: string,
): Promise<FollowSummary> {
  const target = await resolveProfileTarget(viewerId, username);

  // Engellenen profilin sosyal grafiği de gösterilmez.
  if (target.blockedByViewer) {
    return {
      followerCount: 0,
      followingCount: 0,
      isFollowing: false,
      blockedByViewer: true,
    };
  }

  const targetId = target.id;
  const database = getDatabase();

  const [followerRows, followingRows, viewerEdge] = await Promise.all([
    database
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.followingId, targetId)),
    database
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.followerId, targetId)),
    database
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId),
          eq(follows.followingId, targetId),
        ),
      )
      .limit(1),
  ]);

  return {
    followerCount: followerRows[0]?.total ?? 0,
    followingCount: followingRows[0]?.total ?? 0,
    isFollowing: viewerEdge.length > 0,
    blockedByViewer: false,
  };
}

type SuggestionRow = {
  id: string;
  username: string;
  displayName: string;
  avatarObjectKey: string | null;
  department: string;
  bio: string;
  followerCount: number;
  mutualCount: number;
  createdAt: Date;
};

function toSuggestedMemberSummary(
  row: SuggestionRow,
  mutualNames: string[],
  newMemberThreshold: Date,
): SuggestedMemberSummary {
  return {
    ...toFollowMemberSummary(row),
    department: row.department,
    bio: row.bio,
    followerCount: row.followerCount,
    mutualCount: row.mutualCount,
    mutualNames,
    isNewMember: row.createdAt.getTime() >= newMemberThreshold.getTime(),
  };
}

/**
 * Ortak takipçilerin adları yalnızca rozet metni için gerekiyor. Aday başına
 * ayrı sorgu açmak yerine hepsi tek turda çekilip bellekte gruplanıyor.
 */
async function loadMutualFollowerNames(
  viewerId: string,
  candidateIds: string[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();

  if (candidateIds.length === 0) {
    return grouped;
  }

  const targetEdge = alias(follows, "target_edge");
  const viewerEdge = alias(follows, "viewer_edge");

  const rows = await getDatabase()
    .select({
      targetId: targetEdge.followingId,
      displayName: users.displayName,
    })
    .from(targetEdge)
    .innerJoin(
      viewerEdge,
      and(
        eq(viewerEdge.followerId, viewerId),
        eq(viewerEdge.followingId, targetEdge.followerId),
      ),
    )
    .innerJoin(users, eq(users.id, targetEdge.followerId))
    .where(
      and(
        inArray(targetEdge.followingId, candidateIds),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    // En yeni takip ilişkisi önce: rozette tanıdık isim çıkma ihtimali yüksek.
    .orderBy(desc(viewerEdge.createdAt))
    .limit(candidateIds.length * MUTUAL_NAME_LIMIT * 4);

  for (const row of rows) {
    const names = grouped.get(row.targetId) ?? [];

    if (names.length < MUTUAL_NAME_LIMIT) {
      names.push(row.displayName);
      grouped.set(row.targetId, names);
    }
  }

  return grouped;
}

export async function getSuggestedMembers(
  viewerId: string,
  limit = SUGGESTION_LIMIT,
): Promise<SuggestedMemberSummary[]> {
  const database = getDatabase();

  const [viewer] = await database
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, viewerId))
    .limit(1);

  if (!viewer) {
    return [];
  }

  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    SUGGESTION_MAX_LIMIT,
  );

  // Profil sayfasındaki takipçi sayısıyla aynı hesap; orada da ham satır
  // sayılıyor, iki yüzeyin farklı sayı göstermesi kafa karıştırır.
  const followerCountSql = sql<number>`(
    select count(*)::int
    from ${follows} as follower_edge
    where follower_edge.following_id = ${users.id}
  )`;

  // Görüntüleyenin takip ettiği kaç kişi bu adayı da takip ediyor. Askıya
  // alınmış hesaplar sayılmıyor, çünkü adları rozette de gösterilmiyor.
  const mutualCountSql = sql<number>`(
    select count(*)::int
    from ${follows} as target_edge
    where target_edge.following_id = ${users.id}
      and exists (
        select 1
        from ${follows} as viewer_edge
        inner join ${users} as mutual_user
          on mutual_user.id = viewer_edge.following_id
        where viewer_edge.follower_id = ${viewerId}
          and viewer_edge.following_id = target_edge.follower_id
          and mutual_user.status = 'active'
          and mutual_user.deleted_at is null
      )
  )`;

  const selection = {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarObjectKey: users.avatarObjectKey,
    department: users.department,
    // Biyografi öneri kartında ilk bakışta görünüyor.
    bio: users.bio,
    createdAt: users.createdAt,
    followerCount: followerCountSql.as("follower_count"),
    mutualCount: mutualCountSql.as("mutual_count"),
  };

  // Ortak takipçisi olanlar üste: rozetin bir işe yaraması için sıranın da
  // sinyali izlemesi gerekiyor. Eşitlikte rastgelelik korunuyor ki liste her
  // ziyarette aynı yüzlerde donup kalmasın.
  const suggestionOrder = [sql`mutual_count desc`, sql`random()`];

  const baseFilters: SQL[] = [
    ne(users.id, viewerId),
    eq(users.status, "active"),
    isNull(users.deletedAt),
    notExists(
      database
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerId),
            eq(follows.followingId, users.id),
          ),
        ),
    ),
    notExists(
      database
        .select({ blockerId: blocks.blockerId })
        .from(blocks)
        .where(
          or(
            and(
              eq(blocks.blockerId, viewerId),
              eq(blocks.blockedId, users.id),
            ),
            and(
              eq(blocks.blockerId, users.id),
              eq(blocks.blockedId, viewerId),
            ),
          ),
        ),
    ),
  ];

  const sameDepartmentRows = await database
    .select(selection)
    .from(users)
    .where(and(...baseFilters, eq(users.department, viewer.department)))
    .orderBy(...suggestionOrder)
    .limit(safeLimit);

  let rows = sameDepartmentRows;

  if (sameDepartmentRows.length < safeLimit) {
    const excludedIds = sameDepartmentRows.map((row) => row.id);
    const backfillFilters = excludedIds.length > 0
      ? [...baseFilters, notInArray(users.id, excludedIds)]
      : baseFilters;

    const otherRows = await database
      .select(selection)
      .from(users)
      .where(and(...backfillFilters))
      .orderBy(...suggestionOrder)
      .limit(safeLimit - sameDepartmentRows.length);

    rows = [...sameDepartmentRows, ...otherRows];
  }

  const mutualNames = await loadMutualFollowerNames(
    viewerId,
    rows.filter((row) => row.mutualCount > 0).map((row) => row.id),
  );

  const newMemberThreshold = new Date(
    Date.now() - NEW_MEMBER_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  return rows.map((row) =>
    toSuggestedMemberSummary(
      row,
      mutualNames.get(row.id) ?? [],
      newMemberThreshold,
    ),
  );
}

type FollowListQuery = {
  cursor?: string;
  limit?: number;
};

const emptyFollowPage = {
  data: [] as FollowMemberSummary[],
  page: { nextCursor: null, hasMore: false },
};

async function listFollowEdges(
  viewerId: string,
  username: string,
  direction: "followers" | "following",
  query: FollowListQuery,
) {
  const target = await resolveProfileTarget(viewerId, username);

  if (target.blockedByViewer) {
    return emptyFollowPage;
  }

  const limit = query.limit ?? FOLLOW_LIST_LIMIT;
  const scope = `${direction}:${target.id}`;
  const isFollowers = direction === "followers";
  const filters = [
    isFollowers
      ? eq(follows.followingId, target.id)
      : eq(follows.followerId, target.id),
    noBlockBetween(viewerId, users.id),
  ];

  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);

    filters.push(
      or(
        lt(follows.createdAt, cursor.createdAt),
        and(eq(follows.createdAt, cursor.createdAt), lt(users.id, cursor.id)),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
      createdAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(
      users,
      eq(users.id, isFollowers ? follows.followerId : follows.followingId),
    )
    .where(and(...filters))
    .orderBy(desc(follows.createdAt), desc(users.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: toFollowMemberSummary,
  });
}

export function listFollowers(
  viewerId: string,
  username: string,
  query: FollowListQuery = {},
) {
  return listFollowEdges(viewerId, username, "followers", query);
}

export function listFollowing(
  viewerId: string,
  username: string,
  query: FollowListQuery = {},
) {
  return listFollowEdges(viewerId, username, "following", query);
}
