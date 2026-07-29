import { NextResponse } from "next/server";

import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
  setSessionCookie,
} from "@/server/auth/request";
import { verifyOtpCode } from "@/server/auth/service";
import {
  parseAuthInput,
  verifyCodeSchema,
} from "@/server/auth/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = parseAuthInput(verifyCodeSchema, body);
    const result = await verifyOtpCode(input);

    if (result.kind === "registration") {
      return NextResponse.json(
        {
          data: {
            registrationToken: result.registrationToken,
            registrationExpiresAt:
              result.registrationExpiresAt.toISOString(),
          },
        },
        {
          headers: noStoreHeaders,
        },
      );
    }

    const response = NextResponse.json(
      { data: result.state },
      { headers: noStoreHeaders },
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
