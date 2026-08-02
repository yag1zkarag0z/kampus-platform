import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccountAvatar } from "@/server/account/service";
import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";

import { GET } from "./route";

vi.mock("@/server/account/service", () => ({
  getAccountAvatar: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedGetAccountAvatar = vi.mocked(getAccountAvatar);

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

function routeContext(username: string) {
  return { params: Promise.resolve({ username }) } as never;
}

describe("GET /v1/users/[username]/avatar", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedGetAccountAvatar.mockReset().mockResolvedValue({
      body: Buffer.from([1, 2, 3]),
      contentType: "image/webp",
    });
  });

  it("serves the avatar only after member authorization", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/users/kampuslu35/avatar`,
    );
    const response = await GET(request, routeContext("kampuslu35"));

    expect(mockedGetAccountAvatar).toHaveBeenCalledWith("kampuslu35");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );
    const request = new NextRequest(
      `${appOrigin}/v1/users/kampuslu35/avatar`,
    );

    const response = await GET(request, routeContext("kampuslu35"));

    expect(response.status).toBe(401);
    expect(mockedGetAccountAvatar).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no avatar", async () => {
    mockedGetAccountAvatar.mockRejectedValueOnce(
      new AuthError(
        "AVATAR_NOT_FOUND",
        "Profil fotoğrafı bulunamadı veya artık görüntülenemiyor.",
        { status: 404 },
      ),
    );
    const request = new NextRequest(
      `${appOrigin}/v1/users/kampuslu35/avatar`,
    );

    const response = await GET(request, routeContext("kampuslu35"));

    expect(response.status).toBe(404);
  });
});
