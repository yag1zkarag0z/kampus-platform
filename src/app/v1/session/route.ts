import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  authErrorResponse,
  clearSessionCookie,
  noStoreHeaders,
} from "@/server/auth/request";
import { resolveSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveSessionCookie(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    const response = NextResponse.json(
      { data: resolved.state },
      { headers: noStoreHeaders },
    );

    if (resolved.shouldClearCookie) {
      clearSessionCookie(response);
    }

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
