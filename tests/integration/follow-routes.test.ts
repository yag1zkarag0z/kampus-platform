import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  DELETE as deleteFollow,
  POST as postFollow,
} from "@/app/v1/users/[username]/follow/route";
import { GET as getFollowers } from "@/app/v1/users/[username]/followers/route";
import { GET as getFollowing } from "@/app/v1/users/[username]/following/route";
import { GET as getMemberProfile } from "@/app/v1/users/[username]/route";
import { GET as getSuggestedFollows } from "@/app/v1/me/suggested-follows/route";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

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
    username: `f${suffix}`,
  };
}

async function insertAccount(department = "Yazılım Mühendisliği") {
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
      "Takip Öğrencisi",
      department,
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

function createFollowRequest(
  username: string,
  method: "POST" | "DELETE",
  {
    cookie,
    origin = appOrigin,
  }: { cookie?: string; origin?: string } = {},
) {
  return new NextRequest(
    new URL(`/v1/users/${username}/follow`, appOrigin),
    {
      method,
      headers: {
        ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
        Origin: origin,
      },
    },
  );
}

function createGetRequest(
  path: string,
  cookie?: string,
) {
  return new NextRequest(new URL(path, appOrigin), {
    headers: cookie ? { Cookie: `kampus_session=${cookie}` } : undefined,
  });
}

afterEach(async () => {
  if (testEmails.size === 0) {
    return;
  }

  await pool.query("delete from users where email = any($1)", [
    [...testEmails],
  ]);
  testEmails.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("follow routes with PostgreSQL", () => {
  it("follows, lists, and unfollows between two real accounts", async () => {
    const follower = await insertAccount();
    const target = await insertAccount();
    const followerCookie = await createMemberCookie(follower.id);

    const followResponse = await postFollow(
      createFollowRequest(target.username, "POST", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );

    expect(followResponse.status).toBe(200);
    await expect(followResponse.json()).resolves.toEqual({
      data: {
        followerCount: 1,
        followingCount: 0,
        isFollowing: true,
      },
    });

    // Following again is idempotent.
    const repeatFollowResponse = await postFollow(
      createFollowRequest(target.username, "POST", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(repeatFollowResponse.status).toBe(200);
    await expect(repeatFollowResponse.json()).resolves.toEqual({
      data: {
        followerCount: 1,
        followingCount: 0,
        isFollowing: true,
      },
    });

    const targetProfileResponse = await getMemberProfile(
      createGetRequest(`/v1/users/${target.username}`, followerCookie),
      { params: Promise.resolve({ username: target.username }) },
    );
    await expect(targetProfileResponse.json()).resolves.toMatchObject({
      data: {
        followerCount: 1,
        followingCount: 0,
        isFollowing: true,
      },
    });

    const followersResponse = await getFollowers(
      createGetRequest(
        `/v1/users/${target.username}/followers`,
        followerCookie,
      ),
      { params: Promise.resolve({ username: target.username }) },
    );
    await expect(followersResponse.json()).resolves.toEqual({
      data: [
        {
          id: follower.id,
          username: follower.username,
          displayName: "Takip Öğrencisi",
          avatarUrl: null,
        },
      ],
    });

    const followingResponse = await getFollowing(
      createGetRequest(
        `/v1/users/${follower.username}/following`,
        followerCookie,
      ),
      { params: Promise.resolve({ username: follower.username }) },
    );
    await expect(followingResponse.json()).resolves.toEqual({
      data: [
        {
          id: target.id,
          username: target.username,
          displayName: "Takip Öğrencisi",
          avatarUrl: null,
        },
      ],
    });

    const unfollowResponse = await deleteFollow(
      createFollowRequest(target.username, "DELETE", {
        cookie: followerCookie,
      }),
      { params: Promise.resolve({ username: target.username }) },
    );
    expect(unfollowResponse.status).toBe(200);
    await expect(unfollowResponse.json()).resolves.toEqual({
      data: {
        followerCount: 0,
        followingCount: 0,
        isFollowing: false,
      },
    });
  });

  it("rejects following yourself", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const response = await postFollow(
      createFollowRequest(account.username, "POST", { cookie }),
      { params: Promise.resolve({ username: account.username }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("returns 404 when following a nonexistent user", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const response = await postFollow(
      createFollowRequest("does-not-exist", "POST", { cookie }),
      { params: Promise.resolve({ username: "does-not-exist" }) },
    );

    expect(response.status).toBe(404);
  });

  it("rejects a cross-origin follow before changing the database", async () => {
    const follower = await insertAccount();
    const target = await insertAccount();
    const cookie = await createMemberCookie(follower.id);

    const response = await postFollow(
      createFollowRequest(target.username, "POST", {
        cookie,
        origin: "https://attacker.example",
      }),
      { params: Promise.resolve({ username: target.username }) },
    );

    expect(response.status).toBe(403);

    const stored = await pool.query(
      `select 1 from follows
       where follower_id = $1 and following_id = $2`,
      [follower.id, target.id],
    );
    expect(stored.rowCount).toBe(0);
  });

  it("requires an active member session to follow", async () => {
    const target = await insertAccount();

    const response = await postFollow(
      createFollowRequest(target.username, "POST"),
      { params: Promise.resolve({ username: target.username }) },
    );

    expect(response.status).toBe(401);
  });

  it("suggests same-department members first and excludes self, followed, and blocked users", async () => {
    const viewer = await insertAccount("Yazılım Mühendisliği");
    const sameDepartment = await insertAccount("Yazılım Mühendisliği");
    const alreadyFollowed = await insertAccount("Yazılım Mühendisliği");
    const blocked = await insertAccount("Yazılım Mühendisliği");
    const otherDepartment = await insertAccount("İşletme");
    const viewerCookie = await createMemberCookie(viewer.id);

    await postFollow(
      createFollowRequest(alreadyFollowed.username, "POST", {
        cookie: viewerCookie,
      }),
      { params: Promise.resolve({ username: alreadyFollowed.username }) },
    );
    await pool.query(
      "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
      [viewer.id, blocked.id],
    );

    const response = await getSuggestedFollows(
      createGetRequest("/v1/me/suggested-follows", viewerCookie),
    );
    const { data } = (await response.json()) as {
      data: Array<{ id: string; department: string }>;
    };
    const suggestedIds = data.map((entry) => entry.id);

    expect(response.status).toBe(200);
    expect(suggestedIds).toContain(sameDepartment.id);
    expect(suggestedIds).not.toContain(viewer.id);
    expect(suggestedIds).not.toContain(alreadyFollowed.id);
    expect(suggestedIds).not.toContain(blocked.id);
    // Same-department pool (1 member) is smaller than the suggestion
    // limit, so the other-department member should backfill the list.
    expect(suggestedIds).toContain(otherDepartment.id);

    const sameDepartmentIndex = suggestedIds.indexOf(sameDepartment.id);
    const otherDepartmentIndex = suggestedIds.indexOf(otherDepartment.id);
    expect(sameDepartmentIndex).toBeLessThan(otherDepartmentIndex);
  });

  it("requires an active member session for suggestions", async () => {
    const response = await getSuggestedFollows(
      createGetRequest("/v1/me/suggested-follows"),
    );

    expect(response.status).toBe(401);
  });
});
