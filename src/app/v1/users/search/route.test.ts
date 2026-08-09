import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { searchMembers } from "@/server/social/service";

import { GET } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/social/service", () => ({
  searchMembers: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedSearchMembers = vi.mocked(searchMembers);

describe("GET /v1/users/search", () => {
  beforeEach(() => {
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedSearchMembers.mockReset().mockResolvedValue([
      {
        id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
        username: "ecearslan",
        displayName: "Ece Arslan",
        avatarUrl: null,
      },
    ]);
  });

  it("searches visible active members with a normalized query", async () => {
    const response = await GET(
      new NextRequest(`${appOrigin}/v1/users/search?q=%20Ece%20`),
    );

    expect(mockedSearchMembers).toHaveBeenCalledWith(memberId, "Ece");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "650e1d64-2b2e-42dd-b9bd-ea268e91588e",
          username: "ecearslan",
          displayName: "Ece Arslan",
          avatarUrl: null,
        },
      ],
    });
  });

  it("rejects short and unexpected query fields", async () => {
    const response = await GET(
      new NextRequest(`${appOrigin}/v1/users/search?q=e&limit=100`),
    );

    expect(response.status).toBe(400);
    expect(mockedSearchMembers).not.toHaveBeenCalled();
  });
});
