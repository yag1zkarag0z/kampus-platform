import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { blockUser, unblockUser } from "@/server/moderation/service";

import { DELETE, POST } from "./route";

vi.mock("@/server/moderation/service", () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedBlockUser = vi.mocked(blockUser);
const mockedUnblockUser = vi.mocked(unblockUser);

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

function createBlockRequest(
  method: "POST" | "DELETE",
  origin = appOrigin,
) {
  return new NextRequest(
    `${appOrigin}/v1/users/test.user/block`,
    {
      method,
      headers: {
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
    },
  );
}

function routeContext() {
  return { params: Promise.resolve({ username: "test.user" }) };
}

describe("POST /v1/users/[username]/block", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedBlockUser.mockReset().mockResolvedValue(undefined);
  });

  it("blocks the target user", async () => {
    const response = await POST(
      createBlockRequest("POST"),
      routeContext(),
    );

    expect(mockedBlockUser).toHaveBeenCalledWith(memberId, "test.user");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { isBlocked: true },
    });
  });

  it("returns the shared error envelope for a self-block attempt", async () => {
    mockedBlockUser.mockRejectedValueOnce(
      new AuthError("INVALID_REQUEST", "Kendini engelleyemezsin.", {
        status: 400,
      }),
    );

    const response = await POST(
      createBlockRequest("POST"),
      routeContext(),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a cross-origin block before authorization", async () => {
    const response = await POST(
      createBlockRequest("POST", "https://attacker.example"),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedBlockUser).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(
      createBlockRequest("POST"),
      routeContext(),
    );

    expect(response.status).toBe(401);
    expect(mockedBlockUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/users/[username]/block", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedUnblockUser.mockReset().mockResolvedValue(undefined);
  });

  it("unblocks the target user", async () => {
    const response = await DELETE(
      createBlockRequest("DELETE"),
      routeContext(),
    );

    expect(mockedUnblockUser).toHaveBeenCalledWith(memberId, "test.user");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { isBlocked: false },
    });
  });

  it("rejects a cross-origin unblock before authorization", async () => {
    const response = await DELETE(
      createBlockRequest("DELETE", "https://attacker.example"),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(mockedUnblockUser).not.toHaveBeenCalled();
  });
});
