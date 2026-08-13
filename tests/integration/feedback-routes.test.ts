import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { POST as postFeedback } from "@/app/v1/feedback/route";
import { GET as getFeedback } from "@/app/v1/moderation/feedback/route";
import { PATCH as patchFeedback } from "@/app/v1/moderation/feedback/[id]/route";
import { deleteAccount } from "@/server/account/service";
import { createGuestToken } from "@/server/auth/crypto";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const testUserIds = new Set<string>();
const pathPrefix = "/__feedback_test__";

async function insertAccount(role: "member" | "moderator" = "member") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label, bio, role
    ) values ($1, $2, $3, $4, $5, $6, $7)
    returning id`,
    [
      `${BigInt(`0x${suffix}`)}@stu.yasar.edu.tr`,
      `f${suffix}`,
      "Feedback Öğrencisi",
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
      role,
    ],
  );
  const id = result.rows[0]!.id;
  testUserIds.add(id);
  await pool.query("insert into user_settings (user_id) values ($1)", [id]);

  return id;
}

async function memberCookie(
  userId: string,
  role: "member" | "moderator" = "member",
) {
  const session = await createMemberSession(getDatabase(), {
    now: new Date(),
    role,
    userId,
  });

  return session.cookieValue;
}

function request(
  path: string,
  method: "GET" | "POST" | "PATCH",
  options: { cookie?: string; body?: unknown; ipAddress?: string } = {},
) {
  return new NextRequest(new URL(path, appOrigin), {
    method,
    headers: {
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.cookie
        ? { Cookie: `kampus_session=${options.cookie}` }
        : {}),
      ...(options.ipAddress
        ? { "X-Forwarded-For": options.ipAddress }
        : {}),
      Origin: appOrigin,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
}

function uniqueTestIp() {
  const hex = randomUUID().replaceAll("-", "");
  return `10.${Number.parseInt(hex.slice(0, 2), 16)}.${Number.parseInt(hex.slice(2, 4), 16)}.${Number.parseInt(hex.slice(4, 6), 16)}`;
}

afterEach(async () => {
  await pool.query("delete from product_feedback where page_path like $1", [
    `${pathPrefix}%`,
  ]);

  if (testUserIds.size > 0) {
    await pool.query("delete from users where id = any($1::uuid[])", [
      [...testUserIds],
    ]);
    testUserIds.clear();
  }
});

afterAll(async () => {
  await pool.end();
});

describe("feedback routes with PostgreSQL", () => {
  it("rejects duplicate moderation feedback filters", async () => {
    const moderatorId = await insertAccount("moderator");
    const moderatorSession = await memberCookie(moderatorId, "moderator");
    const response = await getFeedback(
      request(
        "/v1/moderation/feedback?status=new&status=resolved",
        "GET",
        { cookie: moderatorSession },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("accepts member and guest feedback, moderates it, and anonymizes a deleted member", async () => {
    const memberId = await insertAccount();
    const moderatorId = await insertAccount("moderator");
    const memberSession = await memberCookie(memberId);
    const moderatorSession = await memberCookie(moderatorId, "moderator");
    const guestSession = `g1.${createGuestToken().token}`;

    const memberResponse = await postFeedback(
      request(`${pathPrefix}/member`, "POST", {
        cookie: memberSession,
        body: {
          category: "bug",
          message: "Mobil menü açıldığında sayfanın odağı geride kalıyor.",
          pagePath: `${pathPrefix}/member`,
        },
      }),
    );
    const guestResponse = await postFeedback(
      request(`${pathPrefix}/guest`, "POST", {
        cookie: guestSession,
        ipAddress: uniqueTestIp(),
        body: {
          category: "suggestion",
          message: "Keşfet filtresine bölüm seçimi eklenebilir.",
          pagePath: `${pathPrefix}/guest`,
        },
      }),
    );
    expect(memberResponse.status).toBe(201);
    expect(guestResponse.status).toBe(201);

    const listResponse = await getFeedback(
      request("/v1/moderation/feedback?limit=10", "GET", {
        cookie: moderatorSession,
      }),
    );
    expect(listResponse.status).toBe(200);
    const payload = (await listResponse.json()) as {
      data: Array<{
        id: string;
        pagePath: string;
        status: string;
        submitter: { kind: string };
      }>;
    };
    const memberItem = payload.data.find(
      (item) => item.pagePath === `${pathPrefix}/member`,
    );
    const guestItem = payload.data.find(
      (item) => item.pagePath === `${pathPrefix}/guest`,
    );
    expect(memberItem?.submitter.kind).toBe("member");
    expect(guestItem?.submitter.kind).toBe("guest");

    const updateResponse = await patchFeedback(
      request(`/v1/moderation/feedback/${memberItem!.id}`, "PATCH", {
        cookie: moderatorSession,
        body: { status: "reviewing" },
      }),
      { params: Promise.resolve({ id: memberItem!.id }) },
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: { id: memberItem!.id, status: "reviewing" },
    });

    await deleteAccount(memberId);
    const feedbackRow = await pool.query<{ user_id: string | null }>(
      "select user_id from product_feedback where id = $1",
      [memberItem!.id],
    );
    expect(feedbackRow.rows[0]?.user_id).toBeNull();
  });

  it("limits guest feedback to twenty submissions per rolling day", async () => {
    const guestSession = `g1.${createGuestToken().token}`;
    const ipAddress = uniqueTestIp();

    for (let index = 0; index < 21; index += 1) {
      const response = await postFeedback(
        request(`${pathPrefix}/quota-${index}`, "POST", {
          cookie: guestSession,
          ipAddress,
          body: {
            category: "other",
            message: `Misafir geri bildirim kotası için yeterince uzun test notu ${index}.`,
            pagePath: `${pathPrefix}/quota-${index}`,
          },
        }),
      );

      expect(response.status).toBe(index < 20 ? 201 : 429);
    }
  });
});
