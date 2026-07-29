import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  getPublicAccountProfile,
  updateAccountProfile,
  updateAccountSettings,
} from "@/server/account/service";
import { AuthError } from "@/server/auth/errors";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testEmails = new Set<string>();

function createAccountFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);

  return {
    email: `profile.${suffix}@stu.yasar.edu.tr`,
    username: `u${suffix}`,
  };
}

async function insertAccount({
  withSettings = true,
}: {
  withSettings?: boolean;
} = {}) {
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
      "Test Öğrencisi",
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
    ],
  );
  const id = result.rows[0]!.id;

  if (withSettings) {
    await pool.query(
      "insert into user_settings (user_id) values ($1)",
      [id],
    );
  }

  return { ...fixture, id };
}

async function expectAuthError(
  action: () => Promise<unknown>,
  code: string,
) {
  let caughtError: unknown;

  try {
    await action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({ code });

  return caughtError as AuthError;
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

describe("profile and settings persistence", () => {
  it("persists canonical profile/settings and applies department privacy", async () => {
    const account = await insertAccount();
    const nextUsername = `p${account.username.slice(1)}`;

    await updateAccountProfile(account.id, {
      username: nextUsername,
      displayName: "Yeni İsim",
      department: "Bilgisayar Mühendisliği",
      year: "3. sınıf",
      bio: "Yeni bio",
    });
    await updateAccountSettings(account.id, {
      showDepartment: true,
      notifyLikes: false,
    });

    const stored = await pool.query<{
      bio: string;
      department: string;
      display_name: string;
      notify_likes: boolean;
      show_department: boolean;
      username: string;
      year_label: string;
    }>(
      `select
        app_user.username,
        app_user.display_name,
        app_user.department,
        app_user.year_label,
        app_user.bio,
        settings.show_department,
        settings.notify_likes
      from users as app_user
      join user_settings as settings on settings.user_id = app_user.id
      where app_user.id = $1`,
      [account.id],
    );

    expect(stored.rows[0]).toEqual({
      username: nextUsername,
      display_name: "Yeni İsim",
      department: "Bilgisayar Mühendisliği",
      year_label: "3. sınıf",
      bio: "Yeni bio",
      show_department: true,
      notify_likes: false,
    });

    const visibleProfile = await getPublicAccountProfile(
      nextUsername.toUpperCase(),
    );

    expect(visibleProfile).toMatchObject({
      id: account.id,
      username: nextUsername,
      displayName: "Yeni İsim",
      department: "Bilgisayar Mühendisliği",
      year: "3. sınıf",
    });
    expect(visibleProfile).not.toHaveProperty("email");
    expect(visibleProfile).not.toHaveProperty("showDepartment");

    await updateAccountSettings(account.id, {
      showDepartment: false,
    });
    const privateProfile =
      await getPublicAccountProfile(nextUsername);

    expect(privateProfile.department).toBeNull();
    expect(privateProfile.year).toBeNull();
  });

  it("creates a missing settings row with database defaults", async () => {
    const account = await insertAccount({ withSettings: false });

    await updateAccountSettings(account.id, {
      notifyReplies: false,
    });

    const result = await pool.query<{
      email_notifications: boolean;
      notify_announcements: boolean;
      notify_likes: boolean;
      notify_replies: boolean;
      show_department: boolean;
    }>(
      `select
        show_department,
        notify_replies,
        notify_likes,
        notify_announcements,
        email_notifications
      from user_settings
      where user_id = $1`,
      [account.id],
    );

    expect(result.rows[0]).toEqual({
      show_department: false,
      notify_replies: false,
      notify_likes: true,
      notify_announcements: true,
      email_notifications: true,
    });
  });

  it("validates the final stored department and year for partial updates", async () => {
    const account = await insertAccount();

    const incompatibleDepartmentError = await expectAuthError(
      () =>
        updateAccountProfile(account.id, {
          department: "Lisansüstü program",
        }),
      "INVALID_REQUEST",
    );

    expect(
      incompatibleDepartmentError.fieldErrors.year,
    ).toBeDefined();

    const unchanged = await pool.query<{
      department: string;
      year_label: string;
    }>(
      `select department, year_label
       from users
       where id = $1`,
      [account.id],
    );

    expect(unchanged.rows[0]).toEqual({
      department: "Yazılım Mühendisliği",
      year_label: "2. sınıf",
    });

    await updateAccountProfile(account.id, {
      year: "4. sınıf",
    });

    const incompatibleProgramError = await expectAuthError(
      () =>
        updateAccountProfile(account.id, {
          department: "Bilgisayar Programcılığı",
        }),
      "INVALID_REQUEST",
    );

    expect(incompatibleProgramError.fieldErrors.year).toBeDefined();

    await updateAccountProfile(account.id, {
      department: "Lisansüstü program",
      year: "Lisansüstü",
    });

    const finalProfile = await pool.query<{
      department: string;
      year_label: string;
    }>(
      `select department, year_label
       from users
       where id = $1`,
      [account.id],
    );

    expect(finalProfile.rows[0]).toEqual({
      department: "Lisansüstü program",
      year_label: "Lisansüstü",
    });
  });

  it("maps reserved and case-insensitive username collisions", async () => {
    const first = await insertAccount();
    const second = await insertAccount();

    const reservedError = await expectAuthError(
      () =>
        updateAccountProfile(second.id, {
          username: "admin",
        }),
      "USERNAME_TAKEN",
    );
    const collisionError = await expectAuthError(
      () =>
        updateAccountProfile(second.id, {
          username: first.username.toUpperCase(),
        }),
      "USERNAME_TAKEN",
    );

    expect(reservedError.status).toBe(409);
    expect(collisionError.status).toBe(409);
    expect(collisionError.fieldErrors.username).toBeDefined();
  });

  it("hides and rejects writes for suspended accounts", async () => {
    const account = await insertAccount();

    await pool.query(
      `update users
       set status = 'suspended', suspended_at = now()
       where id = $1`,
      [account.id],
    );

    await expectAuthError(
      () => getPublicAccountProfile(account.username),
      "USER_NOT_FOUND",
    );
    await expectAuthError(
      () =>
        updateAccountProfile(account.id, {
          displayName: "Değişmemeli",
        }),
      "AUTHENTICATION_REQUIRED",
    );
    await expectAuthError(
      () =>
        updateAccountSettings(account.id, {
          notifyLikes: false,
        }),
      "AUTHENTICATION_REQUIRED",
    );
  });
});
