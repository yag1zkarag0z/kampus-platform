import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { createDevelopmentLogin } from "@/server/auth/development";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  setSessionCookie,
} from "@/server/auth/request";
import { revokeMemberSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDevelopmentLoginEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_LOGIN === "true"
  );
}

export async function POST(request: NextRequest) {
  if (!isDevelopmentLoginEnabled()) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Bu endpoint bulunamadı.",
          fieldErrors: {},
        },
      },
      { status: 404, headers: noStoreHeaders },
    );
  }

  try {
    assertSameOrigin(request);
    const result = await createDevelopmentLogin();
    await revokeMemberSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );

    const response = NextResponse.json(
      { data: result.state },
      { status: 201, headers: noStoreHeaders },
    );
    setSessionCookie(response, result.cookieValue, result.expiresAt);
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
