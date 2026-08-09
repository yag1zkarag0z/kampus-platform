import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import { authErrorResponse, noStoreHeaders } from "@/server/auth/request";
import { getDirectConversation } from "@/server/messaging/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: ConversationRouteContext,
) {
  try {
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const conversation = await getDirectConversation(member.userId, id);

    return NextResponse.json(
      { data: conversation },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
