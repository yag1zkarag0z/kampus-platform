import { NextRequest, NextResponse } from "next/server";

import { recordAnalyticsEvent } from "@/server/analytics/service";
import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import {
  listDirectMessages,
  sendDirectMessage,
} from "@/server/messaging/service";
import {
  parseMessagingInput,
  sendMessageSchema,
} from "@/server/messaging/validation";
import { parseTimelineQuery } from "@/server/pagination/cursor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationMessagesRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: ConversationMessagesRouteContext,
) {
  try {
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const query = parseTimelineQuery(request.nextUrl.searchParams, {
      defaultLimit: 50,
      maxLimit: 50,
    });
    const messages = await listDirectMessages(member.userId, id, query);

    return NextResponse.json(messages, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: ConversationMessagesRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const input = parseMessagingInput(sendMessageSchema, body);
    const message = await sendDirectMessage(
      member.userId,
      id,
      input.body,
      input.clientMessageId,
    );

    void recordAnalyticsEvent("message_sent", { userId: member.userId });

    return NextResponse.json(
      { data: message },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
