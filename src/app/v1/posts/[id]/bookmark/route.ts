import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { setContentPostBookmark } from "@/server/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateBookmark(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]/bookmark">,
  bookmarked: boolean,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const post = await setContentPostBookmark(
      member.userId,
      id,
      bookmarked,
    );

    return NextResponse.json(
      { data: post },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export function PUT(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]/bookmark">,
) {
  return updateBookmark(request, context, true);
}

export function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]/bookmark">,
) {
  return updateBookmark(request, context, false);
}
