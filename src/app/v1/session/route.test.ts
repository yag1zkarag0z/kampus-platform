import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordDailyActiveUser } from "@/server/analytics/service";
import { resolveSessionCookie } from "@/server/auth/session";

import { GET } from "./route";

vi.mock("@/server/auth/session", () => ({
  resolveSessionCookie: vi.fn(),
}));
vi.mock("@/server/analytics/service", () => ({
  recordDailyActiveUser: vi.fn(),
}));

const mockedResolveSessionCookie = vi.mocked(resolveSessionCookie);
const mockedRecordDailyActiveUser = vi.mocked(recordDailyActiveUser);

describe("GET /v1/session", () => {
  beforeEach(() => {
    mockedResolveSessionCookie.mockReset();
    mockedRecordDailyActiveUser.mockReset().mockResolvedValue(undefined);
  });

  it("returns a no-store signed-out state and clears an invalid cookie", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: true,
      state: {
        mode: "signed-out",
        expiresAt: null,
        user: null,
      },
    });
    const request = new NextRequest(
      "http://localhost:3000/v1/session",
      {
        headers: {
          Cookie: "kampus_session=invalid",
        },
      },
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toEqual({
      data: {
        mode: "signed-out",
        expiresAt: null,
        user: null,
      },
    });
  });

  it("records one daily activity event for a member session", async () => {
    mockedResolveSessionCookie.mockResolvedValue({
      shouldClearCookie: false,
      state: {
        mode: "member",
        expiresAt: "2026-09-12T10:00:00.000Z",
        user: {
          id: "0ebc5296-4cc7-494f-91a9-ae1b195b5109",
          role: "member",
          profile: {
            username: "member",
            displayName: "Member",
            department: "Yazılım Mühendisliği",
            year: "2. sınıf",
            bio: "",
            avatarUrl: null,
            joinedLabel: "Ağustos 2026",
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

    const response = await GET(
      new NextRequest("http://localhost:3000/v1/session", {
        headers: { Cookie: "kampus_session=m1.valid" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedRecordDailyActiveUser).toHaveBeenCalledWith(
      "0ebc5296-4cc7-494f-91a9-ae1b195b5109",
    );
  });
});
