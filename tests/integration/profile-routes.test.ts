import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import sharp from "sharp";

import {
  DELETE as deleteAvatar,
  POST as postAvatar,
} from "@/app/v1/me/avatar/route";
import {
  DELETE as deleteProfile,
  PATCH as patchProfile,
} from "@/app/v1/me/profile/route";
import { PATCH as patchSettings } from "@/app/v1/me/settings/route";
import { GET as getMemberProfile } from "@/app/v1/users/[username]/route";
import { GET as getMemberAvatar } from "@/app/v1/users/[username]/avatar/route";
import { createGuestToken } from "@/server/auth/crypto";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";

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

async function createMemberCookie(userId: string, now = new Date()) {
  const session = await createMemberSession(getDatabase(), {
    now,
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

function createDeleteRequest({
  cookie,
  origin = appOrigin,
}: {
  cookie?: string;
  origin?: string;
} = {}) {
  return new NextRequest(new URL("/v1/me/profile", appOrigin), {
    method: "DELETE",
    headers: {
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
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

async function createTestAvatarFile(color: string, name = "avatar.png") {
  const buffer = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return new File([buffer], name, { type: "image/png" });
}

function createAvatarUploadRequest(
  formData: FormData,
  {
    cookie,
    origin = appOrigin,
  }: { cookie?: string; origin?: string } = {},
) {
  const request = new NextRequest(new URL("/v1/me/avatar", appOrigin), {
    method: "POST",
    headers: {
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
    body: formData,
  });

  return request;
}

function createAvatarDeleteRequest({
  cookie,
  origin = appOrigin,
}: { cookie?: string; origin?: string } = {}) {
  return new NextRequest(new URL("/v1/me/avatar", appOrigin), {
    method: "DELETE",
    headers: {
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      Origin: origin,
    },
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

describe("DELETE /v1/me/profile", () => {
  it(
    "anonymizes the account, revokes sessions, and frees the email " +
      "for reuse",
    async () => {
      const account = await insertAccount();
      const cookie = await createMemberCookie(account.id);
      const challengeId = randomUUID();
      const challengeCreatedAt = new Date();

      await pool.query(
        `insert into otp_challenges (
          id, email, purpose, code_hash, request_ip_hash,
          expires_at, resend_available_at, created_at
        ) values ($1, $2, 'login', $3, $4, $5, $6, $7)`,
        [
          challengeId,
          account.email,
          "a".repeat(64),
          "b".repeat(64),
          new Date(challengeCreatedAt.getTime() + 5 * 60 * 1_000),
          new Date(challengeCreatedAt.getTime() + 30 * 1_000),
          challengeCreatedAt,
        ],
      );

      try {
        const response = await deleteProfile(
          createDeleteRequest({ cookie }),
        );

        expect(response.status).toBe(204);
        expect(
          response.cookies.get("kampus_session")?.value,
        ).toBe("");

        const stored = await pool.query<{
          email: string;
          username: string;
          display_name: string;
          department: string;
          year_label: string;
          bio: string;
          deleted_at: Date | null;
        }>(
          `select email, username, display_name, department, year_label,
                  bio, deleted_at
           from users
           where id = $1`,
          [account.id],
        );

        expect(stored.rows[0]?.email).not.toBe(account.email);
        expect(stored.rows[0]?.username).not.toBe(account.username);
        expect(stored.rows[0]?.display_name).toBe(
          "Silinmiş kullanıcı",
        );
        expect(stored.rows[0]?.department).toBe("Belirtilmedi");
        expect(stored.rows[0]?.year_label).toBe("Belirtilmedi");
        expect(stored.rows[0]?.bio).toBe("");
        expect(stored.rows[0]?.deleted_at).not.toBeNull();

        const challenge = await pool.query<{
          invalidated_at: Date | null;
        }>(
          "select invalidated_at from otp_challenges where id = $1",
          [challengeId],
        );
        expect(challenge.rows[0]?.invalidated_at).not.toBeNull();

        const activeSessions = await pool.query(
          `select id from sessions
           where user_id = $1 and revoked_at is null`,
          [account.id],
        );
        expect(activeSessions.rowCount).toBe(0);

        const reuseResult = await pool.query<{ id: string }>(
          `insert into users (
            email, username, display_name, department, year_label, bio
          ) values ($1, $2, $3, $4, $5, $6)
          returning id`,
          [
            account.email,
            `reuse${account.username}`,
            "Yeniden Kayıt",
            "Yazılım Mühendisliği",
            "1. sınıf",
            "",
          ],
        );
        await pool.query("delete from users where id = $1", [
          reuseResult.rows[0]!.id,
        ]);
      } finally {
        await pool.query("delete from otp_challenges where id = $1", [
          challengeId,
        ]);
        await pool.query("delete from users where id = $1", [
          account.id,
        ]);
        testEmails.delete(account.email);
      }
    },
  );

  it("rejects a cross-origin delete before changing the database", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);

    const response = await deleteProfile(
      createDeleteRequest({
        cookie,
        origin: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(403);

    const stored = await pool.query<{ deleted_at: Date | null }>(
      "select deleted_at from users where id = $1",
      [account.id],
    );
    expect(stored.rows[0]?.deleted_at).toBeNull();
  });

  it("requires a recent login before deleting the account", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(
      account.id,
      new Date(Date.now() - 31 * 60 * 1_000),
    );

    const response = await deleteProfile(
      createDeleteRequest({ cookie }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RECENT_AUTHENTICATION_REQUIRED" },
    });

    const stored = await pool.query<{ deleted_at: Date | null }>(
      "select deleted_at from users where id = $1",
      [account.id],
    );
    expect(stored.rows[0]?.deleted_at).toBeNull();
  });

  it("requires an active member session", async () => {
    const response = await deleteProfile(createDeleteRequest());

    expect(response.status).toBe(401);
  });
});

describe("POST/DELETE /v1/me/avatar", () => {
  it("uploads, replaces, serves, and removes an avatar", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);
    const storage = getMediaStorage();

    try {
      const firstUpload = new FormData();
      firstUpload.set("image", await createTestAvatarFile("#d26f45"));

      const uploadResponse = await postAvatar(
        createAvatarUploadRequest(firstUpload, { cookie }),
      );

      expect(uploadResponse.status).toBe(200);
      const uploadedState = await uploadResponse.json();
      expect(uploadedState.data.user.profile.avatarUrl).toBe(
        `/v1/users/${account.username}/avatar`,
      );

      const firstStored = await pool.query<{
        avatar_object_key: string | null;
      }>("select avatar_object_key from users where id = $1", [
        account.id,
      ]);
      const firstKey = firstStored.rows[0]?.avatar_object_key;
      expect(firstKey).toBeTruthy();

      const avatarResponse = await getMemberAvatar(
        new NextRequest(
          new URL(`/v1/users/${account.username}/avatar`, appOrigin),
          { headers: { Cookie: `kampus_session=${cookie}` } },
        ),
        { params: Promise.resolve({ username: account.username }) },
      );
      expect(avatarResponse.status).toBe(200);
      expect(avatarResponse.headers.get("content-type")).toBe(
        "image/webp",
      );

      const secondUpload = new FormData();
      secondUpload.set("image", await createTestAvatarFile("#2f6f9f"));

      const replaceResponse = await postAvatar(
        createAvatarUploadRequest(secondUpload, { cookie }),
      );
      expect(replaceResponse.status).toBe(200);

      const secondStored = await pool.query<{
        avatar_object_key: string | null;
      }>("select avatar_object_key from users where id = $1", [
        account.id,
      ]);
      const secondKey = secondStored.rows[0]?.avatar_object_key;
      expect(secondKey).toBeTruthy();
      expect(secondKey).not.toBe(firstKey);
      expect(await storage.get(firstKey!)).toBeNull();

      const deleteResponse = await deleteAvatar(
        createAvatarDeleteRequest({ cookie }),
      );
      expect(deleteResponse.status).toBe(200);
      const deletedState = await deleteResponse.json();
      expect(deletedState.data.user.profile.avatarUrl).toBeNull();

      const finalStored = await pool.query<{
        avatar_object_key: string | null;
      }>("select avatar_object_key from users where id = $1", [
        account.id,
      ]);
      expect(finalStored.rows[0]?.avatar_object_key).toBeNull();
      expect(await storage.get(secondKey!)).toBeNull();
    } finally {
      await pool.query("delete from users where id = $1", [account.id]);
      testEmails.delete(account.email);
    }
  });

  it("hides an avatar from a viewer blocked by the profile owner", async () => {
    const owner = await insertAccount();
    const viewer = await insertAccount();
    const ownerCookie = await createMemberCookie(owner.id);
    const viewerCookie = await createMemberCookie(viewer.id);
    const formData = new FormData();
    formData.set("image", await createTestAvatarFile("#d26f45"));

    const uploadResponse = await postAvatar(
      createAvatarUploadRequest(formData, { cookie: ownerCookie }),
    );
    expect(uploadResponse.status).toBe(200);

    const stored = await pool.query<{ avatar_object_key: string | null }>(
      "select avatar_object_key from users where id = $1",
      [owner.id],
    );
    const storageKey = stored.rows[0]?.avatar_object_key;
    expect(storageKey).toBeTruthy();

    try {
      await pool.query(
        "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
        [owner.id, viewer.id],
      );

      const blockedResponse = await getMemberAvatar(
        new NextRequest(
          new URL(`/v1/users/${owner.username}/avatar`, appOrigin),
          { headers: { Cookie: `kampus_session=${viewerCookie}` } },
        ),
        { params: Promise.resolve({ username: owner.username }) },
      );
      expect(blockedResponse.status).toBe(404);

      await pool.query(
        "delete from blocks where blocker_id = $1 and blocked_id = $2",
        [owner.id, viewer.id],
      );
      await pool.query(
        "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
        [viewer.id, owner.id],
      );

      const recoveryResponse = await getMemberAvatar(
        new NextRequest(
          new URL(`/v1/users/${owner.username}/avatar`, appOrigin),
          { headers: { Cookie: `kampus_session=${viewerCookie}` } },
        ),
        { params: Promise.resolve({ username: owner.username }) },
      );
      expect(recoveryResponse.status).toBe(200);
    } finally {
      if (storageKey) {
        await getMediaStorage().delete(storageKey);
      }
    }
  });

  it("rejects a cross-origin upload before authorization", async () => {
    const account = await insertAccount();
    const cookie = await createMemberCookie(account.id);
    const formData = new FormData();
    formData.set("image", await createTestAvatarFile("#d26f45"));

    const response = await postAvatar(
      createAvatarUploadRequest(formData, {
        cookie,
        origin: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(403);

    const stored = await pool.query<{
      avatar_object_key: string | null;
    }>("select avatar_object_key from users where id = $1", [
      account.id,
    ]);
    expect(stored.rows[0]?.avatar_object_key).toBeNull();
  });

  it("requires an active member session to upload", async () => {
    const formData = new FormData();
    formData.set("image", await createTestAvatarFile("#d26f45"));

    const response = await postAvatar(
      createAvatarUploadRequest(formData),
    );

    expect(response.status).toBe(401);
  });
});
