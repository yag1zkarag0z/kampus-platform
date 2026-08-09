import { NextRequest, NextResponse } from "next/server";

import { uploadBodyLimitForPath } from "@/lib/upload-limits";
import { logEvent } from "@/server/observability/logger";
import {
  createRequestId,
  REQUEST_ID_HEADER,
} from "@/server/observability/request-id";

function payloadTooLargeResponse(requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_REQUEST",
        message: "Yükleme isteği izin verilen boyutu aşıyor.",
        fieldErrors: {},
        requestId,
      },
    },
    {
      status: 413,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        [REQUEST_ID_HEADER]: requestId,
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const requestId = createRequestId();
  const requestHeaders = new Headers(request.headers);
  const path = request.nextUrl.pathname;

  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (path !== "/v1/health") {
    logEvent("info", "http.request.received", {
      requestId,
      method: request.method,
      path,
    });
  }

  const nextResponse = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    response.headers.set(REQUEST_ID_HEADER, requestId);

    return response;
  };

  if (request.method !== "POST") return nextResponse();

  const maxBytes = uploadBodyLimitForPath(path);

  if (maxBytes === null) return nextResponse();

  const contentLength = request.headers.get("content-length");

  if (contentLength && /^\d+$/u.test(contentLength.trim())) {
    const declaredBytes = Number(contentLength);

    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      logEvent("warn", "http.request.rejected", {
        requestId,
        method: request.method,
        path,
        status: 413,
        errorCode: "INVALID_REQUEST",
      });

      return payloadTooLargeResponse(requestId);
    }
  }

  return nextResponse();
}

export const config = {
  matcher: "/v1/:path*",
};
