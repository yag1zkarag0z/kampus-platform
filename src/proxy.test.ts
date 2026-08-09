import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_MULTIPART_MAX_BYTES,
  IMAGE_MULTIPART_MAX_BYTES,
} from "@/lib/upload-limits";

import { proxy } from "./proxy";

const appOrigin = "http://localhost:3000";

function uploadRequest(path: string, contentLength: number) {
  return new NextRequest(`${appOrigin}${path}`, {
    method: "POST",
    headers: { "Content-Length": String(contentLength) },
  });
}

describe("upload proxy body limits", () => {
  it("returns 413 before an oversized image reaches its route", async () => {
    const response = proxy(
      uploadRequest("/v1/media", IMAGE_MULTIPART_MAX_BYTES + 1),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const requestId = response.headers.get("x-request-id");

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST", requestId },
    });
  });

  it("uses the larger document ceiling only for the document route", () => {
    const betweenLimits = IMAGE_MULTIPART_MAX_BYTES + 1;

    expect(proxy(uploadRequest("/v1/media", betweenLimits)).status).toBe(413);
    expect(
      proxy(uploadRequest("/v1/media/documents", betweenLimits)).status,
    ).toBe(200);
    expect(betweenLimits).toBeLessThan(DOCUMENT_MULTIPART_MAX_BYTES);
  });

  it("assigns a fresh request id to every API request", () => {
    const incomingId = crypto.randomUUID();
    const first = proxy(
      new NextRequest(`${appOrigin}/v1/posts`, {
        headers: { "X-Request-ID": incomingId },
      }),
    );
    const second = proxy(new NextRequest(`${appOrigin}/v1/posts`));
    const firstId = first.headers.get("x-request-id");
    const secondId = second.headers.get("x-request-id");

    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(secondId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(firstId).not.toBe(incomingId);
    expect(firstId).not.toBe(secondId);
  });

  it("does not apply upload limits to non-POST requests", () => {
    const request = new NextRequest(`${appOrigin}/v1/me/avatar`, {
      method: "DELETE",
      headers: {
        "Content-Length": String(IMAGE_MULTIPART_MAX_BYTES + 1),
      },
    });

    expect(proxy(request).status).toBe(200);
  });
});
