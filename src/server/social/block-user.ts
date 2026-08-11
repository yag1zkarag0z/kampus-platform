import "server-only";

import { and, eq, or } from "drizzle-orm";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { blocks, follows } from "@/server/db/schema";
import { consumeRateLimit } from "@/server/rate-limit/service";

type SocialDatabase = ReturnType<typeof getDatabase>;
type SocialTransaction = Parameters<
  Parameters<SocialDatabase["transaction"]>[0]
>[0];

export async function applyUserBlock(
  transaction: SocialTransaction,
  blockerId: string,
  blockedId: string,
) {
  if (blockerId === blockedId) {
    throw new AuthError(
      "INVALID_REQUEST",
      "Kendini engelleyemezsin.",
      { status: 400 },
    );
  }

  await consumeRateLimit(transaction, blockerId, "block");

  await transaction
    .insert(blocks)
    .values({ blockerId, blockedId })
    .onConflictDoNothing();

  await transaction
    .delete(follows)
    .where(
      or(
        and(
          eq(follows.followerId, blockerId),
          eq(follows.followingId, blockedId),
        ),
        and(
          eq(follows.followerId, blockedId),
          eq(follows.followingId, blockerId),
        ),
      ),
    );
}
