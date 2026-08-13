import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  assertSameOrigin,
  authErrorResponse,
  getRequestIp,
  noStoreHeaders,
  readJsonBody,
  setSessionCookie,
} from "@/server/auth/request";
import { registerAccount } from "@/server/auth/service";
import { revokeMemberSession } from "@/server/auth/session";
import {
  parseAuthInput,
  registerSchema,
} from "@/server/auth/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = parseAuthInput(registerSchema, body);
    const result = await registerAccount({
      ...input,
      ipAddress: getRequestIp(request),
    });
    await revokeMemberSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    const response = NextResponse.json(
      { data: result.state },
      {
        status: 201,
        headers: noStoreHeaders,
      },
    );
    setSessionCookie(
      response,
      result.session.cookieValue,
      result.session.expiresAt,
    );

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
