import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { setContentCommentLike } from "@/server/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateLike(
  request: NextRequest,
  context: RouteContext<"/v1/comments/[id]/like">,
  liked: boolean,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const comment = await setContentCommentLike(member.userId, id, liked);

    return NextResponse.json(
      { data: comment },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export function PUT(
  request: NextRequest,
  context: RouteContext<"/v1/comments/[id]/like">,
) {
  return updateLike(request, context, true);
}

export function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/comments/[id]/like">,
) {
  return updateLike(request, context, false);
}
