import { NextRequest, NextResponse } from "next/server";

import { uploadBodyLimitForPath } from "@/lib/upload-limits";

function payloadTooLargeResponse() {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_REQUEST",
        message: "Yükleme isteği izin verilen boyutu aşıyor.",
        fieldErrors: {},
      },
    },
    {
      status: 413,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  const maxBytes = uploadBodyLimitForPath(request.nextUrl.pathname);

  if (maxBytes === null) return NextResponse.next();

  const contentLength = request.headers.get("content-length");

  if (contentLength && /^\d+$/u.test(contentLength.trim())) {
    const declaredBytes = Number(contentLength);

    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      return payloadTooLargeResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/v1/media", "/v1/media/documents", "/v1/me/avatar"],
};
