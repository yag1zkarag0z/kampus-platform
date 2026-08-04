import "server-only";

import { and, count, eq, gte, min, sql } from "drizzle-orm";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { rateLimitHits } from "@/server/db/schema";

/**
 * Yazma işlemleri için ortak hız sınırı.
 *
 * Sayaçlar `rate_limit_hits` tablosunda tutulur; içerik tablolarını saymak
 * yeterli değildir çünkü beğeni, kaydetme ve takip geri alınabilir. Kullanıcı
 * satırı silip yeniden ekleyerek sınırı sıfırlayabilirdi.
 *
 * Pencere kayan: "son bir saatte kaç istek" diye bakılır. Sabit pencerede
 * saat başlarında iki kat yığılma oluşur.
 */

export type RateLimitAction =
  | "post_create"
  | "comment_create"
  | "report_create"
  | "follow"
  | "block"
  | "interaction";

type RateLimitWindow = {
  windowSeconds: number;
  limit: number;
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Bütün yazma işlemlerini kapsayan tavan. Beğeni, kaydetme ve anket oyu
 * kendi başlarına idempotent olduğu için ayrı sınır almazlar; kötüye
 * kullanımda bu tavana çarparlar.
 */
const GLOBAL_WRITE_WINDOW: RateLimitWindow = {
  windowSeconds: MINUTE,
  limit: 120,
};

const ACTION_WINDOWS: Record<RateLimitAction, RateLimitWindow[]> = {
  post_create: [
    { windowSeconds: HOUR, limit: 10 },
    { windowSeconds: DAY, limit: 30 },
  ],
  comment_create: [{ windowSeconds: MINUTE, limit: 20 }],
  report_create: [{ windowSeconds: DAY, limit: 10 }],
  follow: [{ windowSeconds: HOUR, limit: 60 }],
  block: [{ windowSeconds: HOUR, limit: 30 }],
  interaction: [],
};

type RateLimitDatabase = ReturnType<typeof getDatabase>;
type RateLimitTransaction = Parameters<
  Parameters<RateLimitDatabase["transaction"]>[0]
>[0];
export type RateLimitExecutor = RateLimitDatabase | RateLimitTransaction;

function rateLimitedError(retryAfterSeconds: number) {
  return new AuthError(
    "CONTENT_RATE_LIMITED",
    "Çok kısa sürede fazla işlem yaptın. Biraz bekleyip yeniden dene.",
    {
      retryAfterSeconds,
      status: 429,
    },
  );
}

/**
 * Aynı kullanıcının eşzamanlı istekleri sayımı atlatmasın diye kullanıcı
 * bazında advisory lock alınır. Kilit transaction sonunda kendiliğinden düşer.
 */
async function lockUser(
  executor: RateLimitExecutor,
  userId: string,
) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`rate-limit:${userId}`}, 0))`,
  );
}

async function assertWindow(
  executor: RateLimitExecutor,
  userId: string,
  action: RateLimitAction | null,
  window: RateLimitWindow,
  now: Date,
) {
  const windowStart = new Date(now.getTime() - window.windowSeconds * 1_000);
  const filters = [
    eq(rateLimitHits.userId, userId),
    gte(rateLimitHits.createdAt, windowStart),
  ];

  if (action) {
    filters.push(eq(rateLimitHits.action, action));
  }

  const [usage] = await executor
    .select({
      total: count(),
      oldest: min(rateLimitHits.createdAt),
    })
    .from(rateLimitHits)
    .where(and(...filters));

  if ((usage?.total ?? 0) < window.limit) {
    return;
  }

  // Pencere kayan olduğu için en eski kayıt düştüğü anda yeniden hak doğar.
  const oldest = usage?.oldest ? new Date(usage.oldest) : now;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(
      (oldest.getTime() + window.windowSeconds * 1_000 - now.getTime()) / 1_000,
    ),
  );

  throw rateLimitedError(retryAfterSeconds);
}

/**
 * Sınırı kontrol eder ve aşılmadıysa kullanımı kaydeder.
 *
 * Çağıran transaction içindeyse kayıt da aynı transaction'a yazılır: işlem
 * geri alınırsa kullanım da sayılmaz.
 */
export async function consumeRateLimit(
  executor: RateLimitExecutor,
  userId: string,
  action: RateLimitAction,
  now = new Date(),
) {
  await lockUser(executor, userId);
  await assertWindow(executor, userId, null, GLOBAL_WRITE_WINDOW, now);

  for (const window of ACTION_WINDOWS[action]) {
    await assertWindow(executor, userId, action, window, now);
  }

  await executor.insert(rateLimitHits).values({
    userId,
    action,
    createdAt: now,
  });
}

export const rateLimitConfigForTests = {
  ACTION_WINDOWS,
  GLOBAL_WRITE_WINDOW,
};
