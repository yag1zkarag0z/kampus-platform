import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { uploadContentDocument } from "@/server/media/service";

import { POST } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/media/service", () => ({
  uploadContentDocument: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const assetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedUploadContentDocument = vi.mocked(uploadContentDocument);

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
  const request = new NextRequest(`${appOrigin}/v1/media/documents`, {
    method: "POST",
    headers: {
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
  });

  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

describe("POST /v1/media/documents", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedUploadContentDocument.mockReset().mockResolvedValue({
      id: assetId,
      name: "ders-notlari.pdf",
      sizeBytes: 12_345,
      src: `/v1/media/documents/${assetId}`,
    });
  });

  it("uploads exactly one document for the active member", async () => {
    const formData = new FormData();
    formData.set(
      "document",
      new File([new Uint8Array([1, 2, 3])], "ders-notlari.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(createUploadRequest(formData));

    expect(
      response.status,
      JSON.stringify(await response.clone().json()),
    ).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedUploadContentDocument).toHaveBeenCalledWith(
      memberId,
      expect.objectContaining({ name: "ders-notlari.pdf" }),
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        id: assetId,
        name: "ders-notlari.pdf",
        sizeBytes: 12_345,
        src: `/v1/media/documents/${assetId}`,
      },
    });
  });

  it("rejects extra multipart fields before storing the document", async () => {
    const formData = new FormData();
    formData.set("document", new File(["x"], "ders-notlari.pdf"));
    formData.set("ownerId", "someone-else");

    const response = await POST(createUploadRequest(formData));

    expect(response.status).toBe(400);
    expect(mockedUploadContentDocument).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads before authorization", async () => {
    const formData = new FormData();
    formData.set("document", new File(["x"], "ders-notlari.pdf"));

    const response = await POST(
      createUploadRequest(formData, "https://attacker.example"),
    );

    expect(response.status).toBe(403);
    expect(mockedRequireActiveMember).not.toHaveBeenCalled();
    expect(mockedUploadContentDocument).not.toHaveBeenCalled();
  });
});
