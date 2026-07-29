import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { createGuestToken } from "@/server/auth/crypto";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  setSessionCookie,
} from "@/server/auth/request";
import { revokeMemberSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await revokeMemberSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    const guestSession = createGuestToken();
    const state = {
      mode: "guest" as const,
      expiresAt: guestSession.expiresAt.toISOString(),
      user: null,
    };
    const response = NextResponse.json(
      { data: state },
      {
        status: 201,
        headers: noStoreHeaders,
      },
    );
    setSessionCookie(
      response,
      `g1.${guestSession.token}`,
      guestSession.expiresAt,
    );

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
