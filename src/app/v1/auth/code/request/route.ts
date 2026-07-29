import { NextResponse } from "next/server";

import {
  assertSameOrigin,
  authErrorResponse,
  getRequestIp,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { requestOtpCode } from "@/server/auth/service";
import {
  parseAuthInput,
  requestCodeSchema,
} from "@/server/auth/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = parseAuthInput(requestCodeSchema, body);
    const challenge = await requestOtpCode({
      ...input,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json(
      {
        data: {
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt.toISOString(),
          resendAvailableAt:
            challenge.resendAvailableAt.toISOString(),
          attemptsLeft: challenge.attemptsLeft,
        },
      },
      {
        status: 202,
        headers: noStoreHeaders,
      },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
