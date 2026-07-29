import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { PATCH as patchProfile } from "@/app/v1/me/profile/route";
import { PATCH as patchSettings } from "@/app/v1/me/settings/route";
import { GET as getMemberProfile } from "@/app/v1/users/[username]/route";
import { createGuestToken } from "@/server/auth/crypto";
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

  return {
    email: `route.${suffix}@stu.yasar.edu.tr`,
    username: `r${suffix}`,
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
      "Route Öğrencisi",
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

function createJsonRequest(
  path: string,
  body: unknown,
  {
    cookie,
    origin = appOrigin,
  }: {
    cookie?: string;
    origin?: string;
  } = {},
) {
  return new NextRequest(new URL(path, appOrigin), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function createProfileRequest(username: string, cookie?: string) {
  return new NextRequest(
    new URL(`/v1/users/${username}`, appOrigin),
    {
      headers: cookie
        ? { Cookie: `kampus_session=${cookie}` }
        : undefined,
    },
  );
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

describe("profile route authorization and persistence", () => {
  it("updates profile/settings and reads a public profile through a real member session", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const profileResponse = await patchProfile(
      createJsonRequest(
        "/v1/me/profile",
        {
          displayName: "Güncel Öğrenci",
          department: "Bilgisayar Programcılığı",
          year: "2. sınıf",
          bio: "Route entegrasyon testi",
        },
        { cookie },
      ),
    );

    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toMatchObject({
      data: {
        mode: "member",
        user: {
          profile: {
            displayName: "Güncel Öğrenci",
            department: "Bilgisayar Programcılığı",
            year: "2. sınıf",
          },
        },
      },
    });

    const settingsResponse = await patchSettings(
      createJsonRequest(
        "/v1/me/settings",
        {
          showDepartment: true,
          notifyLikes: false,
        },
        { cookie },
      ),
    );

    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toMatchObject({
      data: {
        mode: "member",
        user: {
          settings: {
            showDepartment: true,
            notifyLikes: false,
          },
        },
      },
    });

    const publicResponse = await getMemberProfile(
      createProfileRequest(account.username, cookie),
      { params: Promise.resolve({ username: account.username }) },
    );

    expect(publicResponse.status).toBe(200);
    await expect(publicResponse.json()).resolves.toMatchObject({
      data: {
        username: account.username,
        displayName: "Güncel Öğrenci",
        department: "Bilgisayar Programcılığı",
        year: "2. sınıf",
      },
    });
  });

  it("rejects an incompatible partial academic update without changing the row", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);
    const response = await patchProfile(
      createJsonRequest(
        "/v1/me/profile",
        { department: "Lisansüstü program" },
        { cookie },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        fieldErrors: {
          year: expect.any(Array),
        },
      },
    });

    const stored = await pool.query<{
      department: string;
      year_label: string;
    }>(
      `select department, year_label
       from users
       where id = $1`,
      [account.id],
    );

    expect(stored.rows[0]).toEqual({
      department: "Yazılım Mühendisliği",
      year_label: "2. sınıf",
    });
  });

  it("rejects a cross-origin mutation before changing the database", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);
    const response = await patchProfile(
      createJsonRequest(
        "/v1/me/profile",
        { displayName: "Değişmemeli" },
        {
          cookie,
          origin: "https://attacker.example",
        },
      ),
    );

    expect(response.status).toBe(403);

    const stored = await pool.query<{ display_name: string }>(
      "select display_name from users where id = $1",
      [account.id],
    );

    expect(stored.rows[0]?.display_name).toBe("Route Öğrencisi");
  });

  it("denies signed-out, guest, revoked, and suspended sessions", async () => {
    const signedOutResponse = await patchProfile(
      createJsonRequest("/v1/me/profile", {
        displayName: "Signed out",
      }),
    );
    expect(signedOutResponse.status).toBe(401);

    const guest = createGuestToken();
    const guestResponse = await patchSettings(
      createJsonRequest(
        "/v1/me/settings",
        { notifyLikes: false },
        { cookie: `g1.${guest.token}` },
      ),
    );
    expect(guestResponse.status).toBe(401);

    const revokedAccount = await insertAccount();
    const revokedCookie = await createMemberCookie(revokedAccount.id);
    await pool.query(
      `update sessions
       set revoked_at = now()
       where user_id = $1`,
      [revokedAccount.id],
    );
    const revokedResponse = await patchProfile(
      createJsonRequest(
        "/v1/me/profile",
        { displayName: "Revoked" },
        { cookie: revokedCookie },
      ),
    );
    expect(revokedResponse.status).toBe(401);

    const suspendedAccount = await insertAccount();
    const suspendedCookie = await createMemberCookie(
      suspendedAccount.id,
    );
    await pool.query(
      `update users
       set status = 'suspended', suspended_at = now()
       where id = $1`,
      [suspendedAccount.id],
    );
    const suspendedResponse = await patchSettings(
      createJsonRequest(
        "/v1/me/settings",
        { notifyReplies: false },
        { cookie: suspendedCookie },
      ),
    );
    expect(suspendedResponse.status).toBe(401);

    const signedOutProfile = await getMemberProfile(
      createProfileRequest(revokedAccount.username),
      {
        params: Promise.resolve({
          username: revokedAccount.username,
        }),
      },
    );
    expect(signedOutProfile.status).toBe(401);

    const guestProfile = await getMemberProfile(
      createProfileRequest(
        revokedAccount.username,
        `g1.${guest.token}`,
      ),
      {
        params: Promise.resolve({
          username: revokedAccount.username,
        }),
      },
    );
    expect(guestProfile.status).toBe(401);
  });
});
