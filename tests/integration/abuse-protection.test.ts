import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createContentPost,
  getContentPost,
  listContentPosts,
} from "@/server/content/service";
import type { FeedQueryInput } from "@/server/content/validation";
import {
  resolveReport,
  submitReport,
} from "@/server/moderation/service";
import { AuthError, type AuthErrorCode } from "@/server/auth/errors";
import { consumeRateLimitForUser } from "@/server/rate-limit/service";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testUserIds = new Set<string>();

function newestFeed(
  overrides: Partial<FeedQueryInput> = {},
): FeedQueryInput {
  return {
    limit: 20,
    sort: "newest",
    scope: "global",
    ...overrides,
  };
}

async function insertUser(label = "Abuse User") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label
    ) values ($1, $2, $3, $4, $5)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `s${suffix}`,
      label,
      "Software Engineering",
      "2. sinif",
    ],
  );
  const id = result.rows[0]!.id;

  testUserIds.add(id);

  return { id, username: `s${suffix}` };
}

/** Otomatik gizleme eşiği yalnızca yeterince eski hesapları sayar. */
async function ageAccount(userId: string, days = 10) {
  await pool.query(
    `update users set created_at = now() - ($2 || ' days')::interval
     where id = $1`,
    [userId, String(days)],
  );
}

async function createTextPost(authorId: string, title = "Metin gönderisi") {
  return createContentPost(authorId, {
    category: "chat",
    title,
    body: "",
    isAnonymous: false,
  });
}

/**
 * Görselli gönderi: GIF alanlarını doğrudan yazıyoruz, böylece test Giphy
 * servisine gitmeden medya içeren bir gönderi elde ediyor.
 */
async function createMediaPost(authorId: string, title = "Görselli gönderi") {
  const post = await createTextPost(authorId, title);

  await pool.query(
    `update posts set
       gif_id = 'seed-gif',
       gif_url = 'https://media.example.com/a.gif',
       gif_width = 320,
       gif_height = 240,
       gif_alt = 'Test GIF'
     where id = $1`,
    [post.id],
  );

  return post;
}

async function fillRateLimitHits(
  userId: string,
  action: string,
  total: number,
) {
  await pool.query(
    `insert into rate_limit_hits (user_id, action, created_at)
     select $1, $2, now() from generate_series(1, $3)`,
    [userId, action, total],
  );
}

async function expectAuthError(
  action: () => Promise<unknown>,
  code: AuthErrorCode,
  status: number,
) {
  let caughtError: unknown;

  try {
    await action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({ code, status });

  return caughtError as AuthError;
}

afterEach(async () => {
  if (testUserIds.size === 0) {
    return;
  }

  const userIds = [...testUserIds];

  await pool.query(
    `delete from moderation_actions
     where post_id in (
       select id from posts where author_id = any($1::uuid[])
     )
     or actor_id = any($1::uuid[])
     or target_user_id = any($1::uuid[])`,
    [userIds],
  );
  await pool.query(
    "delete from reports where reporter_id = any($1::uuid[])",
    [userIds],
  );
  await pool.query(
    `delete from comments
     where author_id = any($1::uuid[])
        or post_id in (
          select id from posts where author_id = any($1::uuid[])
        )`,
    [userIds],
  );
  await pool.query(
    "delete from posts where author_id = any($1::uuid[])",
    [userIds],
  );
  await pool.query(
    "delete from users where id = any($1::uuid[])",
    [userIds],
  );
  testUserIds.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("hız sınırı", () => {
  it("saatlik gönderi sınırını aşan isteği Retry-After ile reddeder", async () => {
    const author = await insertUser("Post Limit Author");

    await fillRateLimitHits(author.id, "post_create", 10);

    const error = await expectAuthError(
      () => createTextPost(author.id),
      "CONTENT_RATE_LIMITED",
      429,
    );

    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(3_600);
  });

  it("günlük şikâyet sınırını uygular", async () => {
    const reporter = await insertUser("Report Limit Reporter");
    const author = await insertUser("Report Limit Author");
    const post = await createTextPost(author.id);

    await fillRateLimitHits(reporter.id, "report_create", 10);

    await expectAuthError(
      () =>
        submitReport(reporter.id, {
          targetType: "post",
          targetId: post.id,
          reason: "spam",
        }),
      "CONTENT_RATE_LIMITED",
      429,
    );
  });

  it("genel yazma tavanı beğeni ve kaydetme gibi işlemleri de kapsar", async () => {
    const author = await insertUser("Ceiling Author");

    // Tavan eylemden bağımsız: farklı bir eylemle dolan sayaç yeni gönderiyi
    // de engellemeli.
    await fillRateLimitHits(author.id, "interaction", 120);

    await expectAuthError(
      () => createTextPost(author.id),
      "CONTENT_RATE_LIMITED",
      429,
    );
  });

  it("sınır altında kalan işlemi geçirir ve kullanımı kaydeder", async () => {
    const author = await insertUser("Under Limit Author");

    await fillRateLimitHits(author.id, "post_create", 9);

    const post = await createTextPost(author.id, "Sınır altında");

    expect(post.id).toEqual(expect.any(String));

    const usage = await pool.query<{ total: string }>(
      `select count(*) as total from rate_limit_hits
       where user_id = $1 and action = 'post_create'`,
      [author.id],
    );

    expect(Number(usage.rows[0]!.total)).toBe(10);
  });

  it("eşzamanlı isteklerle genel yazma tavanının aşılmasına izin vermez", async () => {
    const author = await insertUser("Concurrent Ceiling Author");
    await fillRateLimitHits(author.id, "interaction", 119);

    const results = await Promise.allSettled([
      consumeRateLimitForUser(author.id, "interaction"),
      consumeRateLimitForUser(author.id, "interaction"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "CONTENT_RATE_LIMITED", status: 429 },
    });

    const usage = await pool.query<{ total: string }>(
      "select count(*) as total from rate_limit_hits where user_id = $1",
      [author.id],
    );
    expect(Number(usage.rows[0]!.total)).toBe(120);
  });

  it("eşzamanlı avatar denemelerinde günlük kotayı atomik uygular", async () => {
    const author = await insertUser("Concurrent Avatar Author");
    await fillRateLimitHits(author.id, "avatar_upload", 4);

    const results = await Promise.allSettled([
      consumeRateLimitForUser(author.id, "avatar_upload"),
      consumeRateLimitForUser(author.id, "avatar_upload"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: { code: "CONTENT_RATE_LIMITED", status: 429 },
    });
  });
});

describe("otomatik gizleme", () => {
  async function reportPostFrom(
    reporterIds: string[],
    postId: string,
  ) {
    for (const reporterId of reporterIds) {
      await submitReport(reporterId, {
        targetType: "post",
        targetId: postId,
        reason: "personal_information",
      });
    }
  }

  async function insertAgedReporters(count: number) {
    const reporters: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const reporter = await insertUser(`Reporter ${index}`);
      await ageAccount(reporter.id);
      reporters.push(reporter.id);
    }

    return reporters;
  }

  it("üç bağımsız şikâyetten sonra görselli gönderiyi gizler", async () => {
    const author = await insertUser("Media Author");
    const viewer = await insertUser("Media Viewer");
    const post = await createMediaPost(author.id);
    const reporters = await insertAgedReporters(3);

    await reportPostFrom(reporters, post.id);

    const hidden = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );

    expect(hidden.rows[0]!.hidden_at).not.toBeNull();

    // Başkalarına görünmez, doğrudan URL ile de açılmaz.
    const feed = await listContentPosts(viewer.id, newestFeed());
    expect(feed.data.map((item) => item.id)).not.toContain(post.id);
    await expectAuthError(
      () => getContentPost(viewer.id, post.id),
      "POST_NOT_FOUND",
      404,
    );

    // Yazarı görmeye devam eder ve durumu bilir.
    const authorView = await getContentPost(author.id, post.id);
    expect(authorView.viewerState.hidden).toBe(true);

    const audit = await pool.query<{ action: string; actor_id: string | null }>(
      `select action, actor_id from moderation_actions
       where post_id = $1 and action = 'content_hidden'`,
      [post.id],
    );

    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]!.actor_id).toBeNull();
  });

  it("metin gönderisini üç şikâyete rağmen gizlemez", async () => {
    const author = await insertUser("Text Author");
    const viewer = await insertUser("Text Viewer");
    const post = await createTextPost(author.id, "Susturulmak istenen fikir");
    const reporters = await insertAgedReporters(3);

    await reportPostFrom(reporters, post.id);

    const hidden = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );

    expect(hidden.rows[0]!.hidden_at).toBeNull();

    const feed = await listContentPosts(viewer.id, newestFeed());
    expect(feed.data.map((item) => item.id)).toContain(post.id);
  });

  it("lansman günlerinde yeni hesapların şikâyetlerini de sayar", async () => {
    const author = await insertUser("Fresh Report Author");
    const post = await createMediaPost(author.id);
    const freshReporters: string[] = [];

    // Hesap yaşı şartı yok: aksi hâlde herkesin yeni olduğu ilk günlerde
    // koruma hiç devreye girmezdi.
    for (let index = 0; index < 3; index += 1) {
      const reporter = await insertUser(`Fresh Reporter ${index}`);
      freshReporters.push(reporter.id);
    }

    await reportPostFrom(freshReporters, post.id);

    const hidden = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );

    expect(hidden.rows[0]!.hidden_at).not.toBeNull();
  });

  it("şikâyetleri sürekli reddedilen kullanıcıyı eşiğe saymaz", async () => {
    const author = await insertUser("Credibility Author");
    const post = await createMediaPost(author.id);
    const reporters = await insertAgedReporters(3);
    const [unreliableReporter] = reporters;

    // Geçmişte üç şikâyeti haksız bulunmuş kullanıcı eşiğe katkı vermez.
    await pool.query(
      `insert into reports (
         reporter_id, target_type, target_id, post_id, reason,
         status, resolution, resolved_by, resolved_at
       )
       select $1, 'post', gen_random_uuid(), $2, 'spam',
              'resolved', 'dismissed', $1, now()
       from generate_series(1, 3)`,
      [unreliableReporter, post.id],
    );

    await reportPostFrom(reporters, post.id);

    const hidden = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );

    expect(hidden.rows[0]!.hidden_at).toBeNull();
  });

  it("şikâyet haksız bulununca gönderiyi geri açar ve kaydeder", async () => {
    const author = await insertUser("Restore Author");
    const viewer = await insertUser("Restore Viewer");
    const moderator = await insertUser("Restore Moderator");
    const post = await createMediaPost(author.id);
    const reporters = await insertAgedReporters(3);

    await pool.query("update users set role = 'moderator' where id = $1", [
      moderator.id,
    ]);
    await reportPostFrom(reporters, post.id);

    const pending = await pool.query<{ id: string }>(
      "select id from reports where target_id = $1 limit 1",
      [post.id],
    );

    await resolveReport(
      moderator.id,
      pending.rows[0]!.id,
      "dismissed",
      "İhlal yok",
    );

    const restored = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );

    expect(restored.rows[0]!.hidden_at).toBeNull();

    const feed = await listContentPosts(viewer.id, newestFeed());
    expect(feed.data.map((item) => item.id)).toContain(post.id);

    const audit = await pool.query(
      `select action from moderation_actions
       where post_id = $1 and action = 'content_restored'`,
      [post.id],
    );

    expect(audit.rowCount).toBe(1);
  });

  it("şikâyet eşiği sürerken gönderiyi erken geri açmaz", async () => {
    const author = await insertUser("Threshold Restore Author");
    const moderator = await insertUser("Threshold Restore Moderator");
    const post = await createMediaPost(author.id);
    const reporters = await insertAgedReporters(4);

    await pool.query("update users set role = 'moderator' where id = $1", [
      moderator.id,
    ]);
    await reportPostFrom(reporters, post.id);

    const pending = await pool.query<{ id: string }>(
      `select id from reports
       where target_id = $1 and status = 'pending'
       order by created_at, id`,
      [post.id],
    );

    await resolveReport(
      moderator.id,
      pending.rows[0]!.id,
      "dismissed",
      "İlk itiraz kabul edildi",
    );

    const stillHidden = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );
    expect(stillHidden.rows[0]!.hidden_at).not.toBeNull();

    await resolveReport(
      moderator.id,
      pending.rows[1]!.id,
      "dismissed",
      "Eşik altına düştü",
    );

    const restored = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );
    expect(restored.rows[0]!.hidden_at).toBeNull();

    const audit = await pool.query(
      `select action from moderation_actions
       where post_id = $1 and action = 'content_restored'`,
      [post.id],
    );
    expect(audit.rowCount).toBe(1);
  });

  it("yalnızca aktif otomatik gizleme kaydı bulunan gönderiyi geri açar", async () => {
    const author = await insertUser("Restore Provenance Author");
    const moderator = await insertUser("Restore Provenance Moderator");
    const post = await createMediaPost(author.id);
    const [reporter] = await insertAgedReporters(1);

    await pool.query("update users set role = 'moderator' where id = $1", [
      moderator.id,
    ]);
    await reportPostFrom([reporter], post.id);
    // Başka bir görünürlük politikasıyla gizlenmiş gibi davran; buna karşılık
    // `content_hidden` audit kaydı özellikle yok.
    await pool.query("update posts set hidden_at = now() where id = $1", [
      post.id,
    ]);

    const pending = await pool.query<{ id: string }>(
      "select id from reports where target_id = $1 and status = 'pending'",
      [post.id],
    );
    await resolveReport(
      moderator.id,
      pending.rows[0]!.id,
      "dismissed",
      "Otomatik gizleme kaydı bulunmuyor.",
    );

    const state = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );
    expect(state.rows[0]!.hidden_at).not.toBeNull();

    const restores = await pool.query(
      `select id from moderation_actions
       where post_id = $1 and action = 'content_restored'`,
      [post.id],
    );
    expect(restores.rowCount).toBe(0);
  });

  it("eşzamanlı kararları gönderi kilidiyle sıralayıp restore'u kaçırmaz", async () => {
    const author = await insertUser("Concurrent Restore Author");
    const moderator = await insertUser("Concurrent Restore Moderator");
    const post = await createMediaPost(author.id);
    const reporters = await insertAgedReporters(4);

    await pool.query("update users set role = 'moderator' where id = $1", [
      moderator.id,
    ]);
    await reportPostFrom(reporters, post.id);

    const pending = await pool.query<{ id: string }>(
      `select id from reports
       where target_id = $1 and status = 'pending'
       order by created_at, id`,
      [post.id],
    );

    await Promise.all([
      resolveReport(
        moderator.id,
        pending.rows[0]!.id,
        "dismissed",
        "Birinci eşzamanlı karar.",
      ),
      resolveReport(
        moderator.id,
        pending.rows[1]!.id,
        "dismissed",
        "İkinci eşzamanlı karar.",
      ),
    ]);

    const state = await pool.query<{ hidden_at: Date | null }>(
      "select hidden_at from posts where id = $1",
      [post.id],
    );
    expect(state.rows[0]!.hidden_at).toBeNull();

    const restores = await pool.query(
      `select id from moderation_actions
       where post_id = $1 and action = 'content_restored'`,
      [post.id],
    );
    expect(restores.rowCount).toBe(1);
  });
});
