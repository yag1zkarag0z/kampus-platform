import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { verifyOtpCode } from "@/server/auth/service";
import { revokeMemberSession } from "@/server/auth/session";

import { POST } from "./route";

vi.mock("@/server/auth/service", () => ({
  verifyOtpCode: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({
  revokeMemberSession: vi.fn(),
}));

const mockedVerifyOtpCode = vi.mocked(verifyOtpCode);
const mockedRevokeMemberSession = vi.mocked(revokeMemberSession);

function createRequest(purpose: "registration" | "login") {
  return new NextRequest("http://localhost:3000/v1/auth/code/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.previous-session",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      code: "482951",
      purpose,
    }),
  });
}

describe("POST /v1/auth/code/verify", () => {
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
    mockedVerifyOtpCode.mockReset();
    mockedRevokeMemberSession.mockReset().mockResolvedValue(undefined);
  });

  it("sets an httpOnly 30-day member cookie without exposing its token", async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    mockedVerifyOtpCode.mockResolvedValue({
      kind: "login",
      session: {
        cookieValue: "m1.raw-secret-token",
        rawToken: "raw-secret-token",
        expiresAt,
      },
      state: {
        mode: "member",
        expiresAt: expiresAt.toISOString(),
        user: {
          id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
          role: "member",
          profile: {
            username: "student",
            displayName: "Student",
            department: "Yazılım Mühendisliği",
            year: "2. sınıf",
            bio: "",
            avatarUrl: null,
            joinedLabel: "Temmuz 2026",
          },
          settings: {
            showDepartment: false,
            notifyReplies: true,
            notifyLikes: true,
            notifyAnnouncements: true,
            notifyComments: true,
            notifyFollows: true,
            notifyMentions: true,
            emailNotifications: true,
          },
        },
      },
    });

    const response = await POST(createRequest("login"));
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("kampus_session=m1.raw-secret-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
    expect(JSON.stringify(body)).not.toContain("raw-secret-token");
    expect(mockedRevokeMemberSession).toHaveBeenCalledWith(
      "m1.previous-session",
    );
  });

  it("returns a registration grant without starting a session", async () => {
    mockedVerifyOtpCode.mockResolvedValue({
      kind: "registration",
      registrationToken: "signed-registration-grant",
      registrationExpiresAt: new Date(
        "2026-07-28T10:15:00.000Z",
      ),
    });

    const response = await POST(createRequest("registration"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mockedRevokeMemberSession).not.toHaveBeenCalled();
    expect(body).toEqual({
      data: {
        registrationToken: "signed-registration-grant",
        registrationExpiresAt: "2026-07-28T10:15:00.000Z",
      },
    });
  });
});
