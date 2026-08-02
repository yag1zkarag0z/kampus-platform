import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { POST as postReport } from "@/app/v1/reports/route";
import { GET as getReports } from "@/app/v1/moderation/reports/route";
import { POST as postResolveReport } from "@/app/v1/moderation/reports/[id]/resolve/route";
import { GET as getManagedUsers } from "@/app/v1/moderation/users/route";
import { PATCH as patchUserStatus } from "@/app/v1/moderation/users/[id]/status/route";
import { PATCH as patchUserRole } from "@/app/v1/moderation/users/[id]/role/route";
import { GET as getHistory } from "@/app/v1/moderation/history/route";
import { createContentPost } from "@/server/content/service";
import { createMemberSession, resolveSessionCookie } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import type { AuthRole } from "@/auth/types";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const testEmails = new Set<string>();

function createAccountFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();

  return {
    email: `${studentNumber}@stu.yasar.edu.tr`,
    username: `m${suffix}`,
  };
}

async function insertAccount(role: AuthRole = "member") {
  const fixture = createAccountFixture();
  testEmails.add(fixture.email);
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label,
      bio,
      role
    ) values ($1, $2, $3, $4, $5, $6, $7)
    returning id`,
    [
      fixture.email,
      fixture.username,
      "Moderasyon Öğrencisi",
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
      role,
    ],
  );
  const id = result.rows[0]!.id;

  await pool.query("insert into user_settings (user_id) values ($1)", [id]);

  return { ...fixture, id };
}

async function createMemberCookie(userId: string, role: AuthRole = "member") {
  const session = await createMemberSession(getDatabase(), {
    now: new Date(),
    role,
    userId,
  });

  return session.cookieValue;
}

function jsonRequest(
  url: string,
  method: string,
  {
    cookie,
    origin = appOrigin,
    body,
  }: { cookie?: string; origin?: string; body?: unknown } = {},
) {
  return new NextRequest(new URL(url, appOrigin), {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function plainRequest(
  url: string,
  { cookie }: { cookie?: string } = {},
) {
  return new NextRequest(new URL(url, appOrigin), {
    headers: cookie ? { Cookie: `kampus_session=${cookie}` } : undefined,
  });
}

afterEach(async () => {
  if (testEmails.size === 0) {
    return;
  }

  await pool.query(
    `delete from moderation_actions
     where actor_id in (select id from users where email = any($1))
        or target_user_id in (select id from users where email = any($1))`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from reports
     where reporter_id in (select id from users where email = any($1))
        or resolved_by in (select id from users where email = any($1))`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from comments
     where author_id in (select id from users where email = any($1))
        or post_id in (
          select id from posts
          where author_id in (select id from users where email = any($1))
        )`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from posts where author_id in (
      select id from users where email = any($1)
    )`,
    [[...testEmails]],
  );
  await pool.query("delete from users where email = any($1)", [
    [...testEmails],
  ]);
  testEmails.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("moderation routes with PostgreSQL", () => {
  it("submits a report, lists it for moderators, and dismisses it with an audit trail", async () => {
    const author = await insertAccount();
    const reporter = await insertAccount();
    const moderator = await insertAccount("moderator");

    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Kurallara aykırı gönderi",
      body: "",
      isAnonymous: false,
    });

    const reporterCookie = await createMemberCookie(reporter.id);
    const submitResponse = await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie: reporterCookie,
        body: { targetType: "post", targetId: post.id, reason: "spam" },
      }),
    );
    expect(submitResponse.status).toBe(201);
    await expect(submitResponse.json()).resolves.toEqual({
      data: { created: true },
    });

    const moderatorCookie = await createMemberCookie(
      moderator.id,
      "moderator",
    );
    const listResponse = await getReports(
      plainRequest("/v1/moderation/reports?status=pending", {
        cookie: moderatorCookie,
      }),
    );
    expect(listResponse.status).toBe(200);
    const { data: pendingReports } = (await listResponse.json()) as {
      data: Array<{ id: string; target: { excerpt: string } }>;
    };
    const report = pendingReports.find((entry) =>
      entry.target.excerpt.includes("Kurallara aykırı gönderi"),
    );
    expect(report).toBeDefined();

    const resolveResponse = await postResolveReport(
      jsonRequest(
        `/v1/moderation/reports/${report!.id}/resolve`,
        "POST",
        {
          cookie: moderatorCookie,
          body: { resolution: "dismissed", note: "İhlal bulunamadı." },
        },
      ),
      { params: Promise.resolve({ id: report!.id }) },
    );
    expect(resolveResponse.status).toBe(204);

    const historyResponse = await getHistory(
      plainRequest("/v1/moderation/history", { cookie: moderatorCookie }),
    );
    const { data: history } = (await historyResponse.json()) as {
      data: Array<{
        action: string;
        note: string | null;
        actor: { username: string };
      }>;
    };
    expect(
      history.some(
        (entry) =>
          entry.action === "report_dismissed" &&
          entry.note === "İhlal bulunamadı." &&
          entry.actor.username === moderator.username,
      ),
    ).toBe(true);
  });

  it("does not create a duplicate report for the same target", async () => {
    const author = await insertAccount();
    const reporter = await insertAccount();
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Tekrar şikâyet edilecek gönderi",
      body: "",
      isAnonymous: false,
    });
    const reporterCookie = await createMemberCookie(reporter.id);

    await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie: reporterCookie,
        body: { targetType: "post", targetId: post.id, reason: "spam" },
      }),
    );
    const secondResponse = await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie: reporterCookie,
        body: { targetType: "post", targetId: post.id, reason: "spam" },
      }),
    );

    expect(secondResponse.status).toBe(201);
    await expect(secondResponse.json()).resolves.toEqual({
      data: { created: false },
    });

    const countResult = await pool.query(
      "select count(*)::int as total from reports where target_id = $1",
      [post.id],
    );
    expect(countResult.rows[0]?.total).toBe(1);
  });

  it("rejects reporting your own content", async () => {
    const author = await insertAccount();
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Kendi gönderim",
      body: "",
      isAnonymous: false,
    });
    const cookie = await createMemberCookie(author.id);

    const response = await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie,
        body: { targetType: "post", targetId: post.id, reason: "other" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("returns 404 when reporting a nonexistent post", async () => {
    const reporter = await insertAccount();
    const cookie = await createMemberCookie(reporter.id);

    const response = await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie,
        body: {
          targetType: "post",
          targetId: randomUUID(),
          reason: "other",
        },
      }),
    );

    expect(response.status).toBe(404);
  });

  it("blocks a non-moderator member from the moderation endpoints", async () => {
    const member = await insertAccount();
    const cookie = await createMemberCookie(member.id);

    const reportsResponse = await getReports(
      plainRequest("/v1/moderation/reports", { cookie }),
    );
    const usersResponse = await getManagedUsers(
      plainRequest("/v1/moderation/users", { cookie }),
    );
    const historyResponse = await getHistory(
      plainRequest("/v1/moderation/history", { cookie }),
    );

    expect(reportsResponse.status).toBe(403);
    expect(usersResponse.status).toBe(403);
    expect(historyResponse.status).toBe(403);
  });

  it("removes the reported content when resolved with content_removed", async () => {
    const author = await insertAccount();
    const reporter = await insertAccount();
    const moderator = await insertAccount("moderator");
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Kaldırılacak gönderi",
      body: "",
      isAnonymous: false,
    });
    const reporterCookie = await createMemberCookie(reporter.id);
    await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie: reporterCookie,
        body: { targetType: "post", targetId: post.id, reason: "spam" },
      }),
    );
    const reportRow = await pool.query<{ id: string }>(
      "select id from reports where target_id = $1",
      [post.id],
    );
    const reportId = reportRow.rows[0]!.id;
    const moderatorCookie = await createMemberCookie(
      moderator.id,
      "moderator",
    );

    const response = await postResolveReport(
      jsonRequest(`/v1/moderation/reports/${reportId}/resolve`, "POST", {
        cookie: moderatorCookie,
        body: { resolution: "content_removed" },
      }),
      { params: Promise.resolve({ id: reportId }) },
    );

    expect(response.status).toBe(204);
    const postRow = await pool.query<{ deleted_at: Date | null }>(
      "select deleted_at from posts where id = $1",
      [post.id],
    );
    expect(postRow.rows[0]?.deleted_at).not.toBeNull();
  });

  it("suspends the reported author when resolved with user_suspended and invalidates their session", async () => {
    const author = await insertAccount();
    const reporter = await insertAccount();
    const moderator = await insertAccount("moderator");
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Askıya alınacak yazarın gönderisi",
      body: "",
      isAnonymous: false,
    });
    const authorCookie = await createMemberCookie(author.id);
    const reporterCookie = await createMemberCookie(reporter.id);
    await postReport(
      jsonRequest("/v1/reports", "POST", {
        cookie: reporterCookie,
        body: { targetType: "post", targetId: post.id, reason: "harassment" },
      }),
    );
    const reportRow = await pool.query<{ id: string }>(
      "select id from reports where target_id = $1",
      [post.id],
    );
    const reportId = reportRow.rows[0]!.id;
    const moderatorCookie = await createMemberCookie(
      moderator.id,
      "moderator",
    );

    const response = await postResolveReport(
      jsonRequest(`/v1/moderation/reports/${reportId}/resolve`, "POST", {
        cookie: moderatorCookie,
        body: { resolution: "user_suspended" },
      }),
      { params: Promise.resolve({ id: reportId }) },
    );

    expect(response.status).toBe(204);
    const userRow = await pool.query<{ status: string }>(
      "select status from users where id = $1",
      [author.id],
    );
    expect(userRow.rows[0]?.status).toBe("suspended");

    const resolvedSession = await resolveSessionCookie(authorCookie);
    expect(resolvedSession.state.mode).not.toBe("member");
  });

  it("prevents a moderator from suspending another moderator or admin", async () => {
    const moderatorA = await insertAccount("moderator");
    const moderatorB = await insertAccount("moderator");
    const cookieA = await createMemberCookie(moderatorA.id, "moderator");

    const response = await patchUserStatus(
      jsonRequest(
        `/v1/moderation/users/${moderatorB.id}/status`,
        "PATCH",
        { cookie: cookieA, body: { status: "suspended" } },
      ),
      { params: Promise.resolve({ id: moderatorB.id }) },
    );

    expect(response.status).toBe(403);
    const userRow = await pool.query<{ status: string }>(
      "select status from users where id = $1",
      [moderatorB.id],
    );
    expect(userRow.rows[0]?.status).toBe("active");
  });

  it("allows an admin to suspend a moderator", async () => {
    const admin = await insertAccount("admin");
    const moderator = await insertAccount("moderator");
    const adminCookie = await createMemberCookie(admin.id, "admin");

    const response = await patchUserStatus(
      jsonRequest(`/v1/moderation/users/${moderator.id}/status`, "PATCH", {
        cookie: adminCookie,
        body: { status: "suspended", note: "Kural ihlali." },
      }),
      { params: Promise.resolve({ id: moderator.id }) },
    );

    expect(response.status).toBe(204);
    const userRow = await pool.query<{ status: string }>(
      "select status from users where id = $1",
      [moderator.id],
    );
    expect(userRow.rows[0]?.status).toBe("suspended");
  });

  it("prevents an admin from changing their own role", async () => {
    const admin = await insertAccount("admin");
    const adminCookie = await createMemberCookie(admin.id, "admin");

    const response = await patchUserRole(
      jsonRequest(`/v1/moderation/users/${admin.id}/role`, "PATCH", {
        cookie: adminCookie,
        body: { role: "member" },
      }),
      { params: Promise.resolve({ id: admin.id }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    const userRow = await pool.query<{ role: string }>(
      "select role from users where id = $1",
      [admin.id],
    );
    expect(userRow.rows[0]?.role).toBe("admin");
  });

  it("allows an admin to promote a member and records the change in the audit log", async () => {
    const admin = await insertAccount("admin");
    const member = await insertAccount();
    const adminCookie = await createMemberCookie(admin.id, "admin");

    const response = await patchUserRole(
      jsonRequest(`/v1/moderation/users/${member.id}/role`, "PATCH", {
        cookie: adminCookie,
        body: { role: "moderator" },
      }),
      { params: Promise.resolve({ id: member.id }) },
    );

    expect(response.status).toBe(204);
    const userRow = await pool.query<{ role: string }>(
      "select role from users where id = $1",
      [member.id],
    );
    expect(userRow.rows[0]?.role).toBe("moderator");

    const historyResponse = await getHistory(
      plainRequest("/v1/moderation/history", { cookie: adminCookie }),
    );
    const { data: history } = (await historyResponse.json()) as {
      data: Array<{
        action: string;
        note: string | null;
        actor: { username: string };
        target: { username: string } | null;
      }>;
    };
    expect(
      history.some(
        (entry) =>
          entry.action === "role_changed" &&
          entry.actor.username === admin.username &&
          entry.target?.username === member.username &&
          entry.note === "member → moderator",
      ),
    ).toBe(true);

    const managedUsersResponse = await getManagedUsers(
      plainRequest("/v1/moderation/users", { cookie: adminCookie }),
    );
    const { data: managedUsers } = (await managedUsersResponse.json()) as {
      data: Array<{ id: string; role: string }>;
    };
    expect(
      managedUsers.some(
        (user) => user.id === member.id && user.role === "moderator",
      ),
    ).toBe(true);
  });

  it("rejects a moderator attempting to change roles", async () => {
    const moderator = await insertAccount("moderator");
    const member = await insertAccount();
    const moderatorCookie = await createMemberCookie(
      moderator.id,
      "moderator",
    );

    const response = await patchUserRole(
      jsonRequest(`/v1/moderation/users/${member.id}/role`, "PATCH", {
        cookie: moderatorCookie,
        body: { role: "moderator" },
      }),
      { params: Promise.resolve({ id: member.id }) },
    );

    expect(response.status).toBe(403);
  });

  it("rejects cross-origin moderation mutations before touching the database", async () => {
    const moderator = await insertAccount("moderator");
    const member = await insertAccount();
    const moderatorCookie = await createMemberCookie(
      moderator.id,
      "moderator",
    );

    const response = await patchUserStatus(
      jsonRequest(`/v1/moderation/users/${member.id}/status`, "PATCH", {
        cookie: moderatorCookie,
        origin: "https://attacker.example",
        body: { status: "suspended" },
      }),
      { params: Promise.resolve({ id: member.id }) },
    );

    expect(response.status).toBe(403);
    const userRow = await pool.query<{ status: string }>(
      "select status from users where id = $1",
      [member.id],
    );
    expect(userRow.rows[0]?.status).toBe("active");
  });

  it("requires an active session to submit a report", async () => {
    const author = await insertAccount();
    const post = await createContentPost(author.id, {
      category: "chat",
      title: "Oturumsuz erişim testi",
      body: "",
      isAnonymous: false,
    });

    const response = await postReport(
      jsonRequest("/v1/reports", "POST", {
        body: { targetType: "post", targetId: post.id, reason: "spam" },
      }),
    );

    expect(response.status).toBe(401);
  });
});
