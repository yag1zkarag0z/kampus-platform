import "server-only";

import { and, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { comments, posts, users } from "@/server/db/schema";
import { noBlockBetween } from "@/server/social/blocking";

/**
 * Canonical read policy for a post. The policy deliberately checks the author
 * in a subquery so it can be reused in queries where `users` already represents
 * another role, such as a comment author.
 */
export function postVisibleToViewer(
  viewerId: string,
  postAuthorId: AnyPgColumn = posts.authorId,
  postDeletedAt: AnyPgColumn = posts.deletedAt,
  postHiddenAt: AnyPgColumn = posts.hiddenAt,
): SQL {
  return and(
    isNull(postDeletedAt),
    noBlockBetween(viewerId, postAuthorId),
    sql`(${postHiddenAt} is null or ${postAuthorId} = ${viewerId})`,
    sql`exists (
      select 1
      from ${users} as visibility_post_author
      where visibility_post_author.id = ${postAuthorId}
        and visibility_post_author.status = 'active'
        and visibility_post_author.deleted_at is null
    )`,
  )!;
}

/**
 * Deleted authors remain as tombstones in threads, but suspended authors and
 * blocked relationships must not contribute visible comments or counters.
 */
export function commentVisibleToViewer(
  viewerId: string,
  commentAuthorId: AnyPgColumn = comments.authorId,
): SQL {
  return and(
    noBlockBetween(viewerId, commentAuthorId),
    sql`exists (
      select 1
      from ${users} as visibility_comment_author
      where visibility_comment_author.id = ${commentAuthorId}
        and visibility_comment_author.status = 'active'
    )`,
  )!;
}

/** A deleted comment author may be shown as a tombstone, but not interacted with. */
export function commentInteractableByViewer(
  viewerId: string,
  commentAuthorId: AnyPgColumn = comments.authorId,
): SQL {
  return and(
    noBlockBetween(viewerId, commentAuthorId),
    sql`exists (
      select 1
      from ${users} as interactable_comment_author
      where interactable_comment_author.id = ${commentAuthorId}
        and interactable_comment_author.status = 'active'
        and interactable_comment_author.deleted_at is null
    )`,
  )!;
}
