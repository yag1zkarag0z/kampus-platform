import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRecentActiveAdmin } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { setUserRole } from "@/server/moderation/service";

import { PATCH } from "./route";

vi.mock("@/server/moderation/service", () => ({
  setUserRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireRecentActiveAdmin: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const adminId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const targetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireRecentActiveAdmin = vi.mocked(requireRecentActiveAdmin);
const mockedSetUserRole = vi.mocked(setUserRole);

function configureEnvironment() {
  process.env.AUTH_SECRET =
    "kampus-test-secret-that-is-at-least-32-characters";
  process.env.APP_ORIGIN = appOrigin;
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1025";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
}

function createRequest(body: unknown, origin = appOrigin) {
  return new NextRequest(
    `${appOrigin}/v1/moderation/users/${targetId}/role`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
      body: JSON.stringify(body),
    },
  );
}

function context(id = targetId) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /v1/moderation/users/[id]/role", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireRecentActiveAdmin.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: adminId,
    });
    mockedSetUserRole.mockReset().mockResolvedValue(undefined);
  });

  it("updates the target user's role", async () => {
    const response = await PATCH(
      createRequest({ role: "moderator", note: "Ekip görevlendirmesi." }),
      context(),
    );

    expect(mockedSetUserRole).toHaveBeenCalledWith(
      adminId,
      targetId,
      "moderator",
      "Ekip görevlendirmesi.",
    );
    expect(response.status).toBe(204);
  });

  it("propagates a self-lockout rejection", async () => {
    mockedSetUserRole.mockRejectedValueOnce(
      new AuthError("INVALID_REQUEST", "Kendi rolünü değiştiremezsin.", {
        status: 400,
      }),
    );

    const response = await PATCH(
      createRequest({ role: "member", note: "Yetki kaldırılıyor." }),
      context(),
    );

    expect(response.status).toBe(400);
  });

  it("rejects malformed input and cross-origin requests", async () => {
    const malformed = await PATCH(
      createRequest({ role: "superadmin", note: "Geçersiz rol." }),
      context(),
    );
    const crossOrigin = await PATCH(
      createRequest(
        { role: "moderator", note: "Ekip görevlendirmesi." },
        "https://attacker.example",
      ),
      context(),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mockedSetUserRole).not.toHaveBeenCalled();
  });

  it("rejects a non-admin caller", async () => {
    mockedRequireRecentActiveAdmin.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );

    const response = await PATCH(
      createRequest({ role: "moderator", note: "Ekip görevlendirmesi." }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedSetUserRole).not.toHaveBeenCalled();
  });

  it("requires a reason and a valid target id", async () => {
    const missingReason = await PATCH(
      createRequest({ role: "moderator" }),
      context(),
    );
    const invalidTarget = await PATCH(
      createRequest({ role: "moderator", note: "Ekip görevlendirmesi." }),
      context("not-a-uuid"),
    );

    expect(missingReason.status).toBe(400);
    expect(invalidTarget.status).toBe(400);
    expect(mockedSetUserRole).not.toHaveBeenCalled();
  });
});
