import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  deleteUnattachedContentDocument,
  getVisibleContentDocument,
} from "@/server/media/service";

import { DELETE, GET } from "./route";

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

vi.mock("@/server/media/service", () => ({
  deleteUnattachedContentDocument: vi.fn(),
  getVisibleContentDocument: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const assetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedGetVisibleContentDocument = vi.mocked(getVisibleContentDocument);
const mockedDeleteUnattachedContentDocument = vi.mocked(
  deleteUnattachedContentDocument,
);

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

function routeContext() {
  return { params: Promise.resolve({ id: assetId }) } as never;
}

describe("/v1/media/documents/[id]", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedGetVisibleContentDocument.mockReset().mockResolvedValue({
      body: Buffer.from([1, 2, 3]),
      contentType: "application/pdf",
      fileName: "ders-notlari.pdf",
    });
    mockedDeleteUnattachedContentDocument.mockReset().mockResolvedValue();
  });

  it("serves a visible document as a forced download only after member authorization", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/media/documents/${assetId}`,
    );
    const response = await GET(request, routeContext());

    expect(mockedGetVisibleContentDocument).toHaveBeenCalledWith(
      memberId,
      assetId,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="ders-notlari.pdf"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("escapes double quotes in the file name before setting the header", async () => {
    mockedGetVisibleContentDocument.mockResolvedValue({
      body: Buffer.from([1]),
      contentType: "application/pdf",
      fileName: 'weird"file.pdf',
    });

    const request = new NextRequest(
      `${appOrigin}/v1/media/documents/${assetId}`,
    );
    const response = await GET(request, routeContext());

    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"weird'file.pdf\"",
    );
  });

  it("deletes an unattached document owned by the active member", async () => {
    const request = new NextRequest(
      `${appOrigin}/v1/media/documents/${assetId}`,
      {
        method: "DELETE",
        headers: { Origin: appOrigin },
      },
    );
    const response = await DELETE(request, routeContext());

    expect(response.status).toBe(204);
    expect(mockedDeleteUnattachedContentDocument).toHaveBeenCalledWith(
      memberId,
      assetId,
    );
  });
});
