import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { blocks, follows, users } from "@/server/db/schema";

export type BlockedMemberSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

function userNotFoundError() {
  return new AuthError(
    "USER_NOT_FOUND",
    "Bu kullanıcı adıyla görüntülenebilecek bir profil bulunamadı.",
    { status: 404 },
  );
}

function selfBlockError() {
  return new AuthError(
    "INVALID_REQUEST",
    "Kendini engelleyemezsin.",
    { status: 400 },
  );
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

export async function blockUser(
  blockerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  if (targetId === blockerId) {
    throw selfBlockError();
  }

  await getDatabase().transaction(async (transaction) => {
    await transaction
      .insert(blocks)
      .values({ blockerId, blockedId: targetId })
      .onConflictDoNothing();

    await transaction
      .delete(follows)
      .where(
        or(
          and(
            eq(follows.followerId, blockerId),
            eq(follows.followingId, targetId),
          ),
          and(
            eq(follows.followerId, targetId),
            eq(follows.followingId, blockerId),
          ),
        ),
      );
  });
}

export async function unblockUser(
  blockerId: string,
  targetUsername: string,
) {
  const targetId = await resolveActiveUserId(targetUsername);

  await getDatabase()
    .delete(blocks)
    .where(
      and(
        eq(blocks.blockerId, blockerId),
        eq(blocks.blockedId, targetId),
      ),
    );
}

export async function listBlockedUsers(
  blockerId: string,
): Promise<BlockedMemberSummary[]> {
  const rows = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarObjectKey: users.avatarObjectKey,
    })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, blockerId))
    .orderBy(blocks.createdAt);

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarObjectKey
      ? `/v1/users/${row.username}/avatar`
      : null,
  }));
}
