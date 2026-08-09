import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveModerator } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { restoreUser, suspendUser } from "@/server/moderation/service";

import { PATCH } from "./route";

vi.mock("@/server/moderation/service", () => ({
  restoreUser: vi.fn(),
  suspendUser: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveModerator: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const moderatorId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const targetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveModerator = vi.mocked(requireActiveModerator);
const mockedSuspendUser = vi.mocked(suspendUser);
const mockedRestoreUser = vi.mocked(restoreUser);

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
    `${appOrigin}/v1/moderation/users/${targetId}/status`,
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

function context() {
  return { params: Promise.resolve({ id: targetId }) };
}

describe("PATCH /v1/moderation/users/[id]/status", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveModerator.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: moderatorId,
    });
    mockedSuspendUser.mockReset().mockResolvedValue(undefined);
    mockedRestoreUser.mockReset().mockResolvedValue(undefined);
  });

  it("suspends the target user", async () => {
    const response = await PATCH(
      createRequest({ status: "suspended", note: "Tekrarlayan ihlal." }),
      context(),
    );

    expect(mockedSuspendUser).toHaveBeenCalledWith(
      moderatorId,
      targetId,
      "Tekrarlayan ihlal.",
    );
    expect(mockedRestoreUser).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
  });

  it("restores the target user", async () => {
    const response = await PATCH(
      createRequest({ status: "active", note: "İtiraz kabul edildi." }),
      context(),
    );

    expect(mockedRestoreUser).toHaveBeenCalledWith(
      moderatorId,
      targetId,
      "İtiraz kabul edildi.",
    );
    expect(mockedSuspendUser).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
  });

  it("requires a reason for every account status transition", async () => {
    const response = await PATCH(
      createRequest({ status: "active" }),
      context(),
    );
    const suspendResponse = await PATCH(
      createRequest({ status: "suspended" }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(suspendResponse.status).toBe(400);
    expect(mockedRestoreUser).not.toHaveBeenCalled();
    expect(mockedSuspendUser).not.toHaveBeenCalled();
  });

  it("propagates a role-hierarchy rejection", async () => {
    mockedSuspendUser.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );

    const response = await PATCH(
      createRequest({ status: "suspended", note: "Yetki testi." }),
      context(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects malformed input and cross-origin requests", async () => {
    const malformed = await PATCH(
      createRequest({ status: "banned" }),
      context(),
    );
    const crossOrigin = await PATCH(
      createRequest({ status: "suspended" }, "https://attacker.example"),
      context(),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mockedSuspendUser).not.toHaveBeenCalled();
  });

  it("rejects a non-moderator caller", async () => {
    mockedRequireActiveModerator.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );

    const response = await PATCH(
      createRequest({ status: "suspended" }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mockedSuspendUser).not.toHaveBeenCalled();
  });
});
