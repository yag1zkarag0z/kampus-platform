import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { AuthError } from "@/server/auth/errors";
import type { OtpMailer } from "@/server/auth/mailer";
import {
  registerAccount,
  requestOtpCode,
  verifyOtpCode,
} from "@/server/auth/service";
import { resolveSessionCookie } from "@/server/auth/session";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testEmails = new Set<string>();

function createStudentEmail() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const email = `${studentNumber}@stu.yasar.edu.tr`;
  testEmails.add(email);
  return email;
}

function createCapturingMailer() {
  const deliveries: Array<{
    code: string;
    email: string;
    purpose: "registration" | "login";
  }> = [];
  const mailer: OtpMailer = {
    async sendCode(delivery) {
      deliveries.push(delivery);
    },
  };

  return {
    deliveries,
    mailer,
    latestCode() {
      const delivery = deliveries.at(-1);

      if (!delivery) {
        throw new Error("Expected an OTP delivery.");
      }

      return delivery.code;
    },
  };
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

  const emails = [...testEmails];
  await pool.query("delete from otp_challenges where email = any($1)", [
    emails,
  ]);
  await pool.query("delete from users where email = any($1)", [emails]);
  testEmails.clear();
});

describe("real auth flow", () => {
  it("registers with OTP and creates a revocable 30-day member session", async () => {
    const email = createStudentEmail();
    const delivery = createCapturingMailer();
    const requestedAt = new Date("2026-07-28T10:00:00.000Z");
    const challenge = await requestOtpCode(
      {
        email,
        ipAddress: "127.0.0.1",
        purpose: "registration",
      },
      {
        mailer: delivery.mailer,
        now: requestedAt,
      },
    );
    const verification = await verifyOtpCode(
      {
        challengeId: challenge.challengeId,
        code: delivery.latestCode(),
        purpose: "registration",
      },
      new Date(requestedAt.getTime() + 1_000),
    );

    expect(verification.kind).toBe("registration");

    if (verification.kind !== "registration") {
      throw new Error("Expected a registration grant.");
    }

    const registeredAt = new Date(requestedAt.getTime() + 2_000);
    const registration = await registerAccount(
      {
        registrationToken: verification.registrationToken,
        username: `u${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        displayName: "Test Öğrencisi",
        department: "Yazılım Mühendisliği",
        yearLabel: "2. sınıf",
        bio: "Test hesabı",
        showDepartment: false,
        termsAccepted: true,
        ipAddress: "127.0.0.1",
      },
      registeredAt,
    );

    expect(registration.state).toMatchObject({
      mode: "member",
      user: {
        role: "member",
        profile: {
          displayName: "Test Öğrencisi",
        },
      },
    });
    expect(
      registration.session.expiresAt.getTime() -
        registeredAt.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1_000);

    const databaseRecord = await pool.query<{
      code_hash: string;
      consumed_at: Date | null;
      issued_role: string;
      token_hash: string;
    }>(
      `select
         otp.code_hash,
         otp.consumed_at,
         session.issued_role,
         session.token_hash
       from otp_challenges as otp
       join users as app_user on app_user.email = otp.email
       join sessions as session on session.user_id = app_user.id
       where otp.id = $1
       order by session.created_at desc
       limit 1`,
      [challenge.challengeId],
    );
    const row = databaseRecord.rows[0];

    expect(row?.code_hash).not.toBe(delivery.latestCode());
    expect(row?.token_hash).not.toBe(
      registration.session.rawToken,
    );
    expect(row?.issued_role).toBe("member");
    expect(row?.consumed_at).not.toBeNull();

    const resolved = await resolveSessionCookie(
      registration.session.cookieValue,
      registeredAt,
    );

    expect(resolved.state.mode).toBe("member");
    expect(resolved.shouldClearCookie).toBe(false);

    await expectAuthError(
      () =>
        verifyOtpCode(
          {
            challengeId: challenge.challengeId,
            code: delivery.latestCode(),
            purpose: "registration",
          },
          new Date(registeredAt.getTime() + 1_000),
        ),
      "OTP_USED",
    );
  });

  it("commits each failed attempt and locks the third one", async () => {
    const email = createStudentEmail();
    const delivery = createCapturingMailer();
    const now = new Date("2026-07-28T11:00:00.000Z");
    const challenge = await requestOtpCode(
      {
        email,
        ipAddress: "127.0.0.2",
        purpose: "login",
      },
      { mailer: delivery.mailer, now },
    );
    const wrongCode =
      delivery.latestCode() === "000000" ? "111111" : "000000";

    const firstError = await expectAuthError(
      () =>
        verifyOtpCode({
          challengeId: challenge.challengeId,
          code: wrongCode,
          purpose: "login",
        }, new Date(now.getTime() + 1_000)),
      "OTP_INCORRECT",
    );
    const secondError = await expectAuthError(
      () =>
        verifyOtpCode({
          challengeId: challenge.challengeId,
          code: wrongCode,
          purpose: "login",
        }, new Date(now.getTime() + 2_000)),
      "OTP_INCORRECT",
    );
    const thirdError = await expectAuthError(
      () =>
        verifyOtpCode({
          challengeId: challenge.challengeId,
          code: wrongCode,
          purpose: "login",
        }, new Date(now.getTime() + 3_000)),
      "OTP_LOCKED",
    );

    expect(firstError.attemptsLeft).toBe(2);
    expect(secondError.attemptsLeft).toBe(1);
    expect(thirdError.attemptsLeft).toBe(0);

    const result = await pool.query<{ attempt_count: number }>(
      "select attempt_count from otp_challenges where id = $1",
      [challenge.challengeId],
    );
    expect(result.rows[0]?.attempt_count).toBe(3);
  });

  it("retains and rejects a failed email delivery challenge", async () => {
    const email = createStudentEmail();

    await expectAuthError(
      () =>
        requestOtpCode(
          {
            email,
            ipAddress: "127.0.0.3",
            purpose: "login",
          },
          {
            mailer: {
              async sendCode() {
                throw new Error("SMTP unavailable");
              },
            },
          },
        ),
      "EMAIL_DELIVERY_FAILED",
    );

    const result = await pool.query<{
      delivery_failed_at: Date | null;
      delivery_status: string;
      id: string;
    }>(
      `select id, delivery_status, delivery_failed_at
       from otp_challenges
       where email = $1`,
      [email],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      delivery_status: "failed",
    });
    expect(result.rows[0]?.delivery_failed_at).toBeInstanceOf(Date);

    await expectAuthError(
      () =>
        verifyOtpCode({
          challengeId: result.rows[0]!.id,
          code: "000000",
          purpose: "login",
        }),
      "OTP_NOT_READY",
    );
  });

  it("enforces the 30-second resend cooldown in PostgreSQL", async () => {
    const email = createStudentEmail();
    const delivery = createCapturingMailer();
    const now = new Date("2026-07-28T12:00:00.000Z");

    await requestOtpCode(
      {
        email,
        ipAddress: "127.0.0.4",
        purpose: "login",
      },
      { mailer: delivery.mailer, now },
    );
    const error = await expectAuthError(
      () =>
        requestOtpCode(
          {
            email,
            ipAddress: "127.0.0.4",
            purpose: "login",
          },
          {
            mailer: delivery.mailer,
            now: new Date(now.getTime() + 10_000),
          },
        ),
      "OTP_COOLDOWN",
    );

    expect(error.retryAfterSeconds).toBe(20);
    expect(delivery.deliveries).toHaveLength(1);
  });
});
