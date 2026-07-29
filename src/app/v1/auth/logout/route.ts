import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  assertSameOrigin,
  authErrorResponse,
  clearSessionCookie,
  noStoreHeaders,
} from "@/server/auth/request";
import { revokeMemberSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    try {
      await revokeMemberSession(
        request.cookies.get(SESSION_COOKIE_NAME)?.value,
      );
    } catch {
      console.error(
        "[auth] Database session revocation failed during logout.",
      );
    }

    const response = new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
    clearSessionCookie(response);

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
