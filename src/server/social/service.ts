import "server-only";

import {
  and,
  count,
  desc,
  eq,
  isNull,
  lt,
  ne,
  notExists,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

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

export type SuggestedMemberSummary = FollowMemberSummary & {
  department: string;
};

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

export async function followUser(
  followerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  if (targetId === followerId) {
    throw selfFollowError();
  }

  await assertNotBlocked(followerId, targetId);

  await getDatabase().transaction(async (transaction) => {
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
  });
}

export async function unfollowUser(
  followerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  await getDatabase()
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, targetId),
      ),
    );
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

function toSuggestedMemberSummary(row: {
  id: string;
  username: string;
  displayName: string;
  avatarObjectKey: string | null;
  department: string;
}): SuggestedMemberSummary {
  return { ...toFollowMemberSummary(row), department: row.department };
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

  const selection = {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarObjectKey: users.avatarObjectKey,
    department: users.department,
  };

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
    .orderBy(sql`random()`)
    .limit(limit);

  if (sameDepartmentRows.length >= limit) {
    return sameDepartmentRows.map(toSuggestedMemberSummary);
  }

  const excludedIds = sameDepartmentRows.map((row) => row.id);
  const backfillFilters = excludedIds.length > 0
    ? [...baseFilters, notInArray(users.id, excludedIds)]
    : baseFilters;

  const otherRows = await database
    .select(selection)
    .from(users)
    .where(and(...backfillFilters))
    .orderBy(sql`random()`)
    .limit(limit - sameDepartmentRows.length);

  return [...sameDepartmentRows, ...otherRows].map(toSuggestedMemberSummary);
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
