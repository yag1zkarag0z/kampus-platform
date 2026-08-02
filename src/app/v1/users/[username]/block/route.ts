import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { blockUser, unblockUser } from "@/server/moderation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BlockRouteContext = {
  params: Promise<{ username: string }>;
};

export async function POST(
  request: NextRequest,
  context: BlockRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { username } = await context.params;

    await blockUser(member.userId, username);

    return NextResponse.json(
      { data: { isBlocked: true } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: BlockRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { username } = await context.params;

    await unblockUser(member.userId, username);

    return NextResponse.json(
      { data: { isBlocked: false } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
