import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestOtpCode } from "@/server/auth/service";

import { POST } from "./route";

vi.mock("@/server/auth/service", () => ({
  requestOtpCode: vi.fn(),
}));

const mockedRequestOtpCode = vi.mocked(requestOtpCode);

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/v1/auth/code/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Forwarded-For": "127.0.0.8",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/auth/code/request", () => {
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
    mockedRequestOtpCode.mockReset().mockResolvedValue({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      expiresAt: new Date("2026-07-28T10:05:00.000Z"),
      resendAvailableAt: new Date("2026-07-28T10:00:30.000Z"),
      attemptsLeft: 3,
    });
  });

  it("returns challenge timing but never returns the raw OTP", async () => {
    const response = await POST(
      createRequest({
        email: "202612345@STU.YASAR.EDU.TR",
        purpose: "login",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedRequestOtpCode).toHaveBeenCalledWith({
      email: "202612345@stu.yasar.edu.tr",
      purpose: "login",
      ipAddress: "127.0.0.8",
    });
    expect(body).toEqual({
      data: {
        challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
        expiresAt: "2026-07-28T10:05:00.000Z",
        resendAvailableAt: "2026-07-28T10:00:30.000Z",
        attemptsLeft: 3,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/code/i);
  });

  it.each([
    "student@example.com",
    "student@stu.yasar.edu.tr",
  ])("rejects a non-student-number email before calling the service: %s", async (email) => {
    const response = await POST(
      createRequest({
        email,
        purpose: "login",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedRequestOtpCode).not.toHaveBeenCalled();
  });
});
