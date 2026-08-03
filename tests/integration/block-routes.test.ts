import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  DELETE as deleteBlock,
  POST as postBlock,
} from "@/app/v1/users/[username]/block/route";
import { GET as getMyBlocks } from "@/app/v1/me/blocks/route";
import { createContentPost, listContentPosts } from "@/server/content/service";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { followUser } from "@/server/social/service";

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
    username: `b${suffix}`,
  };
}

async function insertAccount() {
  const fixture = createAccountFixture();
  testEmails.add(fixture.email);
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label,
      bio
    ) values ($1, $2, $3, $4, $5, $6)
    returning id`,
    [
      fixture.email,
      fixture.username,
      "Engelleme Öğrencisi",
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
    ],
  );
  const id = result.rows[0]!.id;

  await pool.query(
    "insert into user_settings (user_id) values ($1)",
    [id],
  );

  return { ...fixture, id };
}

async function createMemberCookie(userId: string) {
  const session = await createMemberSession(getDatabase(), {
    now: new Date(),
    role: "member",
    userId,
  });

  return session.cookieValue;
}

function createBlockRequest(
  username: string,
  method: "POST" | "DELETE",
  {
    cookie,
    origin = appOrigin,
  }: { cookie?: string; origin?: string } = {},
) {
  return new NextRequest(
    new URL(`/v1/users/${username}/block`, appOrigin),
    {
      method,
      headers: {
        ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
        Origin: origin,
      },
    },
  );
}

function createGetBlocksRequest(cookie?: string) {
  return new NextRequest(new URL("/v1/me/blocks", appOrigin), {
    headers: cookie ? { Cookie: `kampus_session=${cookie}` } : undefined,
  });
}

afterEach(async () => {
  if (testEmails.size === 0) {
    return;
  }

  await pool.query(
    `delete from comments
     where author_id in (
       select id from users where email = any($1)
     )
        or post_id in (
          select id from posts
          where author_id in (
            select id from users where email = any($1)
          )
        )`,
    [[...testEmails]],
  );
  await pool.query(
    `delete from posts
     where author_id in (
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

describe("block routes with PostgreSQL", () => {
  it("blocks, lists, and unblocks between two real accounts", async () => {
    const blocker = await insertAccount();
    const target = await insertAccount();
    const blockerCookie = await createMemberCookie(blocker.id);

    const blockResponse = await postBlock(
      createBlockRequest(target.username, "POST", {
        cookie: blockerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(blockResponse.status).toBe(200);
    await expect(blockResponse.json()).resolves.toEqual({
      data: { isBlocked: true },
    });

    // Blocking again is idempotent.
    const repeatBlockResponse = await postBlock(
      createBlockRequest(target.username, "POST", {
        cookie: blockerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(repeatBlockResponse.status).toBe(200);

    const listResponse = await getMyBlocks(
      createGetBlocksRequest(blockerCookie),
    );
    await expect(listResponse.json()).resolves.toEqual({
      data: [
        {
          id: target.id,
          username: target.username,
          displayName: "Engelleme Öğrencisi",
          avatarUrl: null,
        },
      ],
    });

    const unblockResponse = await deleteBlock(
      createBlockRequest(target.username, "DELETE", {
        cookie: blockerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(unblockResponse.status).toBe(200);
    await expect(unblockResponse.json()).resolves.toEqual({
      data: { isBlocked: false },
    });

    const finalListResponse = await getMyBlocks(
      createGetBlocksRequest(blockerCookie),
    );
    await expect(finalListResponse.json()).resolves.toEqual({ data: [] });
  });

  it("rejects blocking yourself", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const response = await postBlock(
      createBlockRequest(account.username, "POST", { cookie }),
      { params: Promise.resolve({ username: account.username }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("returns 404 when blocking a nonexistent user", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const response = await postBlock(
      createBlockRequest("does-not-exist", "POST", { cookie }),
      { params: Promise.resolve({ username: "does-not-exist" }) },
    );

    expect(response.status).toBe(404);
  });

  it("removes the mutual follow relationship and prevents future follows in either direction", async () => {
    const blocker = await insertAccount();
    const target = await insertAccount();

    await followUser(blocker.id, target.username);
    await followUser(target.id, blocker.username);

    const before = await pool.query(
      "select count(*)::int as total from follows",
    );
    expect(before.rows[0]?.total).toBe(2);

    const blockerCookie = await createMemberCookie(blocker.id);
    const blockResponse = await postBlock(
      createBlockRequest(target.username, "POST", {
        cookie: blockerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(blockResponse.status).toBe(200);

    const after = await pool.query(
      "select count(*)::int as total from follows",
    );
    expect(after.rows[0]?.total).toBe(0);

    await expect(
      followUser(target.id, blocker.username),
    ).rejects.toMatchObject({ code: "CONTENT_FORBIDDEN", status: 403 });
    await expect(
      followUser(blocker.id, target.username),
    ).rejects.toMatchObject({ code: "CONTENT_FORBIDDEN", status: 403 });
  });

  it("excludes the blocked author's posts from the viewer's feed", async () => {
    const viewer = await insertAccount();
    const blockedAuthor = await insertAccount();

    await createContentPost(blockedAuthor.id, {
      category: "chat",
      title: "Görünmemesi gereken gönderi",
      body: "",
      isAnonymous: false,
    });
    await createContentPost(viewer.id, {
      category: "chat",
      title: "Görünmesi gereken gönderi",
      body: "",
      isAnonymous: false,
    });

    const beforeBlock = await listContentPosts(viewer.id, {
      limit: 20,
      sort: "newest",
      scope: "global",
    });
    expect(
      beforeBlock.data.some(
        (post) => post.title === "Görünmemesi gereken gönderi",
      ),
    ).toBe(true);

    const viewerCookie = await createMemberCookie(viewer.id);
    const blockResponse = await postBlock(
      createBlockRequest(blockedAuthor.username, "POST", {
        cookie: viewerCookie,
      }),
      { params: Promise.resolve({ username: blockedAuthor.username }) },
    );
    expect(
      blockResponse.status,
      JSON.stringify(await blockResponse.clone().json()),
    ).toBe(200);

    const storedBlock = await pool.query(
      "select 1 from blocks where blocker_id = $1 and blocked_id = $2",
      [viewer.id, blockedAuthor.id],
    );
    expect(storedBlock.rowCount).toBe(1);

    const afterBlock = await listContentPosts(viewer.id, {
      limit: 20,
      sort: "newest",
      scope: "global",
    });
    expect(
      afterBlock.data.some(
        (post) => post.title === "Görünmemesi gereken gönderi",
      ),
    ).toBe(false);
    expect(
      afterBlock.data.some(
        (post) => post.title === "Görünmesi gereken gönderi",
      ),
    ).toBe(true);
  });

  it("rejects a cross-origin block before changing the database", async () => {
    const blocker = await insertAccount();
    const target = await insertAccount();
    const cookie = await createMemberCookie(blocker.id);

    const response = await postBlock(
      createBlockRequest(target.username, "POST", {
        cookie,
        origin: "https://attacker.example",
      }),
      { params: Promise.resolve({ username: target.username }) },
    );

    expect(response.status).toBe(403);

    const stored = await pool.query(
      `select 1 from blocks
       where blocker_id = $1 and blocked_id = $2`,
      [blocker.id, target.id],
    );
    expect(stored.rowCount).toBe(0);
  });

  it("requires an active member session to block", async () => {
    const target = await insertAccount();

    const response = await postBlock(
      createBlockRequest(target.username, "POST"),
      { params: Promise.resolve({ username: target.username }) },
    );

    expect(response.status).toBe(401);
  });
});
