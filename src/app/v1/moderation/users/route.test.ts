import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveModerator } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { listManagedUsers } from "@/server/moderation/service";

import { GET } from "./route";

vi.mock("@/server/moderation/service", () => ({
  listManagedUsers: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveModerator: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const moderatorId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveModerator = vi.mocked(requireActiveModerator);
const mockedListManagedUsers = vi.mocked(listManagedUsers);

const managedUsers = [
  {
    id: moderatorId,
    username: "admin.user",
    displayName: "Admin User",
    department: "Yazılım Mühendisliği",
    role: "admin" as const,
    status: "active" as const,
    suspendedAt: null,
    joinedLabel: "Temmuz 2026",
    avatarUrl: null,
  },
];

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

describe("GET /v1/moderation/users", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveModerator.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: moderatorId,
    });
    mockedListManagedUsers.mockReset().mockResolvedValue(managedUsers);
  });

  it("returns the managed user list", async () => {
    const request = new NextRequest(`${appOrigin}/v1/moderation/users`, {
      headers: { Cookie: "kampus_session=m1.raw-token" },
    });

    const response = await GET(request);

    expect(mockedListManagedUsers).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: managedUsers });
  });

  it("rejects a non-moderator caller", async () => {
    mockedRequireActiveModerator.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );
    const request = new NextRequest(`${appOrigin}/v1/moderation/users`);

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(mockedListManagedUsers).not.toHaveBeenCalled();
  });
});
