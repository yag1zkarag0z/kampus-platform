import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  removeAccountAvatar,
  uploadAccountAvatar,
} from "@/server/account/service";
import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";

import { DELETE, POST } from "./route";

vi.mock("@/server/account/service", () => ({
  removeAccountAvatar: vi.fn(),
  uploadAccountAvatar: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  refreshActiveMemberSession: vi.fn(),
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedRefreshActiveMemberSession = vi.mocked(
  refreshActiveMemberSession,
);
const mockedUploadAccountAvatar = vi.mocked(uploadAccountAvatar);
const mockedRemoveAccountAvatar = vi.mocked(removeAccountAvatar);

const memberState = {
  mode: "member" as const,
  expiresAt: "2026-08-28T10:00:00.000Z",
  user: {
    id: memberId,
    role: "member" as const,
    profile: {
      username: "kampuslu35",
      displayName: "Kampüslü",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "",
      avatarUrl: "/v1/users/kampuslu35/avatar",
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
};

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

function createUploadRequest(formData: FormData, origin = appOrigin) {
  const request = new NextRequest(`${appOrigin}/v1/me/avatar`, {
    method: "POST",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });

  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

function createDeleteRequest(origin = appOrigin) {
  return new NextRequest(`${appOrigin}/v1/me/avatar`, {
    method: "DELETE",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });
}

describe("POST /v1/me/avatar", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedUploadAccountAvatar.mockReset().mockResolvedValue(undefined);
    mockedRefreshActiveMemberSession
      .mockReset()
      .mockResolvedValue(memberState);
  });

  it("uploads exactly one image for the active member and returns the refreshed session", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "avatar.webp", {
        type: "image/webp",
      }),
    );

    const response = await POST(createUploadRequest(formData));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedUploadAccountAvatar).toHaveBeenCalledWith(
      memberId,
      expect.objectContaining({ name: "avatar.webp" }),
    );
    expect(mockedRefreshActiveMemberSession).toHaveBeenCalledWith(
      "m1.raw-token",
    );
    await expect(response.json()).resolves.toEqual({ data: memberState });
  });

  it("rejects extra multipart fields before storing the image", async () => {
    const formData = new FormData();
    formData.set("image", new File(["x"], "avatar.webp"));
    formData.set("ownerId", "someone-else");

    const response = await POST(createUploadRequest(formData));

    expect(response.status).toBe(400);
    expect(mockedUploadAccountAvatar).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads before authorization", async () => {
    const formData = new FormData();
    formData.set("image", new File(["x"], "avatar.webp"));

    const response = await POST(
      createUploadRequest(formData, "https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedUploadAccountAvatar).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );
    const formData = new FormData();
    formData.set("image", new File(["x"], "avatar.webp"));

    const response = await POST(createUploadRequest(formData));

    expect(response.status).toBe(401);
    expect(mockedUploadAccountAvatar).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/me/avatar", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: memberState,
      userId: memberId,
    });
    mockedRemoveAccountAvatar.mockReset().mockResolvedValue(undefined);
    mockedRefreshActiveMemberSession
      .mockReset()
      .mockResolvedValue(memberState);
  });

  it("removes the avatar and returns the refreshed session", async () => {
    const response = await DELETE(createDeleteRequest());

    expect(mockedRemoveAccountAvatar).toHaveBeenCalledWith(memberId);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: memberState });
  });

  it("rejects a cross-origin delete before authorization", async () => {
    const response = await DELETE(
      createDeleteRequest("https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedRemoveAccountAvatar).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await DELETE(createDeleteRequest());

    expect(response.status).toBe(401);
    expect(mockedRemoveAccountAvatar).not.toHaveBeenCalled();
  });
});
