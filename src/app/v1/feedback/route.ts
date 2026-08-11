import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { hashRequestIp } from "@/server/auth/crypto";
import { AuthError } from "@/server/auth/errors";
import {
  assertSameOrigin,
  authErrorResponse,
  getRequestIp,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { resolveSessionCookie } from "@/server/auth/session";
import { submitProductFeedback } from "@/server/feedback/service";
import {
  parseFeedbackInput,
  submitFeedbackSchema,
} from "@/server/feedback/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const resolved = await resolveSessionCookie(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );

    if (resolved.state.mode === "signed-out") {
      throw new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Geri bildirim göndermek için giriş yap veya misafir olarak devam et.",
        { status: 401 },
      );
    }

    const input = parseFeedbackInput(
      submitFeedbackSchema,
      await readJsonBody(request),
    );
    const result = await submitProductFeedback(
      resolved.state.mode === "member"
        ? {
            sessionMode: "member",
            userId: resolved.state.user.id,
            requestIpHash: null,
          }
        : {
            sessionMode: "guest",
            userId: null,
            requestIpHash: hashRequestIp(getRequestIp(request)),
          },
      input,
    );

    return NextResponse.json(
      { data: result },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
