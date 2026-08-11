import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
  readQueryParams,
} from "@/server/auth/request";
import {
  listDirectConversations,
  startDirectConversation,
} from "@/server/messaging/service";
import {
  parseMessagingInput,
  conversationListQuerySchema,
  startConversationSchema,
} from "@/server/messaging/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseMessagingInput(
      conversationListQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const conversations = await listDirectConversations(
      member.userId,
      query.box,
      { cursor: query.cursor, limit: query.limit, search: query.search },
    );

    return NextResponse.json(conversations, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseMessagingInput(startConversationSchema, body);
    const conversation = await startDirectConversation(
      member.userId,
      input.username,
    );

    return NextResponse.json(
      { data: conversation },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
