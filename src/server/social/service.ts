import "server-only";

import {
  and,
  count,
  desc,
  eq,
  isNull,
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

const FOLLOW_LIST_LIMIT = 200;
const SUGGESTION_LIMIT = 8;

export type FollowSummary = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
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
  const [edge] = await getDatabase()
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(
          eq(blocks.blockerId, userId),
          eq(blocks.blockedId, otherUserId),
        ),
        and(
          eq(blocks.blockerId, otherUserId),
          eq(blocks.blockedId, userId),
        ),
      ),
    )
    .limit(1);

  if (edge) {
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
  const targetId = await resolveActiveUserId(username);
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

export async function listFollowers(
  username: string,
): Promise<FollowMemberSummary[]> {
  const targetId = await resolveActiveUserId(username);

  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followingId, targetId))
    .orderBy(desc(follows.createdAt))
    .limit(FOLLOW_LIST_LIMIT);

  return rows.map(toFollowMemberSummary);
}

export async function listFollowing(
  username: string,
): Promise<FollowMemberSummary[]> {
  const targetId = await resolveActiveUserId(username);

  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, targetId))
    .orderBy(desc(follows.createdAt))
    .limit(FOLLOW_LIST_LIMIT);

  return rows.map(toFollowMemberSummary);
}
