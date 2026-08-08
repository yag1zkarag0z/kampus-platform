import "server-only";

import { and, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDatabase } from "@/server/db/client";
import { blocks } from "@/server/db/schema";

/**
 * Engelleme her iki yönde de görünürlüğü kaldırır: engelleyen de engellenen de
 * karşı tarafın içeriğini göremez. Kural tek bir yerde tanımlıdır ki yeni bir
 * liste sorgusu eklendiğinde yanlışlıkla tek yönlü yazılmasın.
 */

type BlockingDatabase = ReturnType<typeof getDatabase>;
type BlockingTransaction = Parameters<
  Parameters<BlockingDatabase["transaction"]>[0]
>[0];
export type BlockingExecutor = BlockingDatabase | BlockingTransaction;

/**
 * Görüntüleyen ile verilen yazar sütunu arasında hiçbir yönde engel
 * bulunmadığını doğrulayan SQL koşulu.
 */
export function noBlockBetween(
  viewerId: string,
  otherUserId: AnyPgColumn,
): SQL {
  return sql`not exists (
    select 1
    from ${blocks}
    where (
        ${blocks.blockerId} = ${viewerId}
        and ${blocks.blockedId} = ${otherUserId}
      ) or (
        ${blocks.blockerId} = ${otherUserId}
        and ${blocks.blockedId} = ${viewerId}
      )
  )`;
}

/**
 * Directional profile policy: a target that blocked the viewer is hidden. A
 * viewer may still open a target they blocked themselves to undo that action.
 */
export function viewerIsNotBlockedBy(
  viewerId: string,
  targetUserId: AnyPgColumn,
): SQL {
  return sql`not exists (
    select 1
    from ${blocks}
    where ${blocks.blockerId} = ${targetUserId}
      and ${blocks.blockedId} = ${viewerId}
  )`;
}

/** İki kullanıcı arasında herhangi bir yönde engel var mı? */
export async function hasBlockBetween(
  executor: BlockingExecutor,
  userId: string,
  otherUserId: string,
): Promise<boolean> {
  if (userId === otherUserId) {
    return false;
  }

  const [edge] = await executor
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

  return Boolean(edge);
}
