import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { markDirectConversationRead } from "@/server/messaging/service";
import {
  markConversationReadSchema,
  parseMessagingInput,
} from "@/server/messaging/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationReadRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: ConversationReadRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const input = parseMessagingInput(markConversationReadSchema, body);
    await markDirectConversationRead(member.userId, id, input.messageId);

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
