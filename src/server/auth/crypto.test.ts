import { beforeEach, describe, expect, it } from "vitest";

import {
  createGuestToken,
  createOpaqueSessionToken,
  createOtpCode,
  createRegistrationGrant,
  hashOtpCode,
  hashRequestIp,
  hashSessionToken,
  otpHashesMatch,
  verifyGuestToken,
  verifyRegistrationGrant,
} from "./crypto";

describe("auth cryptography", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      "kampus-test-secret-that-is-at-least-32-characters";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASSWORD = "";
    process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
  });

  it("creates six-digit OTP codes and stores only a keyed digest", () => {
    const code = createOtpCode();
    const input = {
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      email: "202612345@stu.yasar.edu.tr",
      purpose: "login" as const,
    };
    const hash = hashOtpCode({ ...input, code });

    expect(code).toMatch(/^\d{6}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(code);
    expect(
      otpHashesMatch(hashOtpCode({ ...input, code }), hash),
    ).toBe(true);
    expect(
      otpHashesMatch(hashOtpCode({ ...input, code: "000000" }), hash),
    ).toBe(code === "000000");
  });

  it("uses independent digests for IP addresses and session tokens", () => {
    const token = createOpaqueSessionToken();

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestIp("127.0.0.1")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestIp("127.0.0.1")).not.toBe(
      hashSessionToken("127.0.0.1"),
    );
  });

  it("rejects tampered and expired registration grants", () => {
    const now = new Date("2026-07-28T10:00:00.000Z");
    const grant = createRegistrationGrant({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      email: "202612345@stu.yasar.edu.tr",
      now,
    });

    expect(verifyRegistrationGrant(grant.token, now)).toMatchObject({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      email: "202612345@stu.yasar.edu.tr",
    });
    expect(
      verifyRegistrationGrant(`${grant.token}tampered`, now),
    ).toBeNull();
    expect(
      verifyRegistrationGrant(
        grant.token,
        new Date(grant.expiresAt.getTime() + 1),
      ),
    ).toBeNull();
  });

  it("creates two-hour guest tokens and detects tampering", () => {
    const now = new Date("2026-07-28T10:00:00.000Z");
    const guest = createGuestToken(now);

    expect(verifyGuestToken(guest.token, now)).toMatchObject({
      kind: "guest",
      v: 1,
    });
    expect(verifyGuestToken(`${guest.token}x`, now)).toBeNull();
    expect(
      verifyGuestToken(
        guest.token,
        new Date(guest.expiresAt.getTime() + 1),
      ),
    ).toBeNull();
  });

  it("creates guest tokens even when SMTP is not configured", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;

    expect(createGuestToken().token).toContain(".");
  });
});
