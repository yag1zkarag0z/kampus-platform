import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { voteInContentPoll } from "@/server/content/service";

import { PUT } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/content/service", () => ({
  voteInContentPoll: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const pollId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const optionId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedVoteInContentPoll = vi.mocked(voteInContentPoll);
const post = {
  id: pollId,
  category: "poll" as const,
  isAnonymous: false,
  title: "Seç",
  body: "",
  author: {
    id: memberId,
    username: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
  },
  createdAt: "2026-08-01T10:00:00.000Z",
  editedAt: null,
  likeCount: 0,
  commentCount: 0,
  poll: {
    id: pollId,
    totalVotes: 1,
    options: [{ id: optionId, text: "Bir", voteCount: 1 }],
  },
  viewerState: {
    isAuthor: true,
    canEdit: true,
    canDelete: true,
    liked: false,
    bookmarked: false,
    hidden: false,
    selectedPollOptionId: optionId,
  },
};

function request(origin = appOrigin, body = { optionId }) {
  return new NextRequest(`${appOrigin}/v1/polls/${pollId}/vote`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: pollId }) };
}

describe("/v1/polls/[id]/vote", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      "kampus-test-secret-that-is-at-least-32-characters";
    process.env.APP_ORIGIN = appOrigin;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASSWORD = "";
    process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedVoteInContentPoll.mockReset().mockResolvedValue(post);
  });

  it("persists the selected option", async () => {
    const response = await PUT(request(), context());

    expect(mockedVoteInContentPoll).toHaveBeenCalledWith(
      memberId,
      pollId,
      optionId,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: post });
  });

  it("rejects malformed options and cross-origin mutations", async () => {
    const malformed = await PUT(
      request(appOrigin, { optionId: "invalid" }),
      context(),
    );
    const crossOrigin = await PUT(
      request("https://example.com"),
      context(),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mockedVoteInContentPoll).not.toHaveBeenCalled();
  });
});
