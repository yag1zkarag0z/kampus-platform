import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { IMAGE_MULTIPART_MAX_BYTES } from "@/lib/upload-limits";
import { uploadContentImage } from "@/server/media/service";
import { encodeTestMultipartFormData } from "@/test/multipart";

import { POST } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/media/service", () => ({
  uploadContentImage: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const assetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedUploadContentImage = vi.mocked(uploadContentImage);

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

async function createUploadRequest(formData: FormData, origin = appOrigin) {
  const encoded = await encodeTestMultipartFormData(formData);
  const request = new NextRequest(`${appOrigin}/v1/media`, {
    method: "POST",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      "Content-Type": encoded.contentType,
      Origin: origin,
    },
    body: encoded.body,
  });

  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

describe("POST /v1/media", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedUploadContentImage.mockReset().mockResolvedValue({
      id: assetId,
      src: `/v1/media/${assetId}`,
      width: 640,
      height: 480,
    });
  });

  it("uploads exactly one image for the active member", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "campus.webp", {
        type: "image/webp",
      }),
    );

    const response = await POST(await createUploadRequest(formData));

    expect(
      response.status,
      JSON.stringify(await response.clone().json()),
    ).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedUploadContentImage).toHaveBeenCalledWith(
      memberId,
      expect.objectContaining({ name: "campus.webp" }),
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        id: assetId,
        src: `/v1/media/${assetId}`,
        width: 640,
        height: 480,
      },
    });
  });

  it("rejects extra multipart fields before storing the image", async () => {
    const formData = new FormData();
    formData.set("image", new File(["x"], "campus.webp"));
    formData.set("ownerId", "someone-else");

    const response = await POST(await createUploadRequest(formData));

    expect(response.status).toBe(400);
    expect(mockedUploadContentImage).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body without relying on Content-Length", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File(
        [new Uint8Array(IMAGE_MULTIPART_MAX_BYTES)],
        "oversized.webp",
        { type: "image/webp" },
      ),
    );
    const request = await createUploadRequest(formData);

    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedUploadContentImage).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads before authorization", async () => {
    const formData = new FormData();
    formData.set("image", new File(["x"], "campus.webp"));

    const response = await POST(
      await createUploadRequest(formData, "https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedUploadContentImage).not.toHaveBeenCalled();
  });
});
