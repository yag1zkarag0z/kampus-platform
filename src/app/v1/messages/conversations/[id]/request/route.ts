import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { resolveDirectMessageRequest } from "@/server/messaging/service";
import {
  messageRequestActionSchema,
  parseMessagingInput,
} from "@/server/messaging/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MessageRequestRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: MessageRequestRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const input = parseMessagingInput(messageRequestActionSchema, body);
    const conversation = await resolveDirectMessageRequest(
      member.userId,
      id,
      input.action,
    );

    if (!conversation) {
      return new NextResponse(null, {
        status: 204,
        headers: noStoreHeaders,
      });
    }

    return NextResponse.json(
      { data: conversation },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
