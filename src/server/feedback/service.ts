import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  lt,
  min,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { productFeedback, users } from "@/server/db/schema";
import {
  buildCursorPage,
  decodeTimelineCursor,
} from "@/server/pagination/cursor";
import { consumeRateLimit } from "@/server/rate-limit/service";

import type {
  FeedbackCategory,
  FeedbackStatus,
  SubmitFeedbackInput,
} from "./validation";

const DAY_MS = 24 * 60 * 60 * 1_000;
const GUEST_DAILY_LIMIT = 20;
const DEFAULT_LIST_LIMIT = 20;

type FeedbackDatabase = ReturnType<typeof getDatabase>;
type FeedbackTransaction = Parameters<
  Parameters<FeedbackDatabase["transaction"]>[0]
>[0];

export type FeedbackActor =
  | {
      sessionMode: "member";
      userId: string;
      requestIpHash: null;
    }
  | {
      sessionMode: "guest";
      userId: null;
      requestIpHash: string;
    };

export type FeedbackSummary = {
  id: string;
  category: FeedbackCategory;
  message: string;
  pagePath: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  submitter:
    | {
        kind: "member";
        id: string;
        username: string;
        displayName: string;
      }
    | { kind: "guest" }
    | { kind: "deleted_member" };
};

function feedbackNotFoundError() {
  return new AuthError("FEEDBACK_NOT_FOUND", "Geri bildirim bulunamadı.", {
    status: 404,
  });
}

function guestRateLimitError(retryAfterSeconds: number) {
  return new AuthError(
    "CONTENT_RATE_LIMITED",
    "Bugün için geri bildirim sınırına ulaştın. Yarın yeniden deneyebilirsin.",
    { retryAfterSeconds, status: 429 },
  );
}

async function consumeGuestFeedbackLimit(
  transaction: FeedbackTransaction,
  requestIpHash: string,
  now: Date,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`feedback:guest:${requestIpHash}`}, 0))`,
  );
  const windowStart = new Date(now.getTime() - DAY_MS);
  const [usage] = await transaction
    .select({
      total: count(),
      oldest: min(productFeedback.createdAt),
    })
    .from(productFeedback)
    .where(
      and(
        eq(productFeedback.sessionMode, "guest"),
        eq(productFeedback.requestIpHash, requestIpHash),
        gte(productFeedback.createdAt, windowStart),
      ),
    );

  if ((usage?.total ?? 0) < GUEST_DAILY_LIMIT) return;

  const oldest = usage?.oldest ? new Date(usage.oldest) : now;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((oldest.getTime() + DAY_MS - now.getTime()) / 1_000),
  );
  throw guestRateLimitError(retryAfterSeconds);
}

export async function submitProductFeedback(
  actor: FeedbackActor,
  input: SubmitFeedbackInput,
  now = new Date(),
) {
  return getDatabase().transaction(async (transaction) => {
    if (actor.sessionMode === "member") {
      await consumeRateLimit(
        transaction,
        actor.userId,
        "feedback_create",
        now,
      );
    } else {
      await consumeGuestFeedbackLimit(transaction, actor.requestIpHash, now);
    }

    const [created] = await transaction
      .insert(productFeedback)
      .values({
        userId: actor.userId,
        sessionMode: actor.sessionMode,
        requestIpHash: actor.requestIpHash,
        category: input.category,
        message: input.message,
        pagePath: input.pagePath,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: productFeedback.id });

    if (!created) {
      throw new Error("Feedback insert did not return a row.");
    }

    return { id: created.id };
  });
}

function feedbackScope(
  status?: FeedbackStatus,
  category?: FeedbackCategory,
) {
  return `product-feedback:${status ?? "all"}:${category ?? "all"}`;
}

export async function listProductFeedback(
  filters: { status?: FeedbackStatus; category?: FeedbackCategory } = {},
  query: { cursor?: string; limit?: number } = {},
) {
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const scope = feedbackScope(filters.status, filters.category);
  const where: SQL[] = [];

  if (filters.status) where.push(eq(productFeedback.status, filters.status));
  if (filters.category) {
    where.push(eq(productFeedback.category, filters.category));
  }
  if (query.cursor) {
    const cursor = decodeTimelineCursor(scope, query.cursor);
    where.push(
      or(
        lt(productFeedback.createdAt, cursor.createdAt),
        and(
          eq(productFeedback.createdAt, cursor.createdAt),
          lt(productFeedback.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await getDatabase()
    .select({
      id: productFeedback.id,
      category: productFeedback.category,
      message: productFeedback.message,
      pagePath: productFeedback.pagePath,
      status: productFeedback.status,
      sessionMode: productFeedback.sessionMode,
      createdAt: productFeedback.createdAt,
      updatedAt: productFeedback.updatedAt,
      reviewedAt: productFeedback.reviewedAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(productFeedback)
    .leftJoin(users, eq(users.id, productFeedback.userId))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(productFeedback.createdAt), desc(productFeedback.id))
    .limit(limit + 1);

  return buildCursorPage({
    rows,
    limit,
    scope,
    toDto: (row): FeedbackSummary => ({
      id: row.id,
      category: row.category,
      message: row.message,
      pagePath: row.pagePath,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      submitter:
        row.userId && row.username && row.displayName
          ? {
              kind: "member",
              id: row.userId,
              username: row.username,
              displayName: row.displayName,
            }
          : row.sessionMode === "guest"
            ? { kind: "guest" }
            : { kind: "deleted_member" },
    }),
  });
}

async function assertActiveReviewer(
  transaction: FeedbackTransaction,
  reviewerId: string,
) {
  const [reviewer] = await transaction
    .select({
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, reviewerId))
    .for("update")
    .limit(1);

  if (
    !reviewer ||
    reviewer.role === "member" ||
    reviewer.status !== "active" ||
    reviewer.deletedAt !== null
  ) {
    throw new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
      status: 403,
    });
  }
}

export async function updateProductFeedbackStatus(
  reviewerId: string,
  feedbackId: string,
  status: FeedbackStatus,
  now = new Date(),
) {
  return getDatabase().transaction(async (transaction) => {
    await assertActiveReviewer(transaction, reviewerId);
    const [current] = await transaction
      .select({ id: productFeedback.id, status: productFeedback.status })
      .from(productFeedback)
      .where(eq(productFeedback.id, feedbackId))
      .for("update")
      .limit(1);

    if (!current) throw feedbackNotFoundError();
    if (current.status === status) return { id: current.id, status };

    await consumeRateLimit(transaction, reviewerId, "moderation_write", now);

    const [updated] = await transaction
      .update(productFeedback)
      .set({
        status,
        reviewedBy: status === "new" ? null : reviewerId,
        reviewedAt: status === "new" ? null : now,
        updatedAt: now,
      })
      .where(eq(productFeedback.id, feedbackId))
      .returning({ id: productFeedback.id, status: productFeedback.status });

    if (!updated) throw feedbackNotFoundError();
    return updated;
  });
}
