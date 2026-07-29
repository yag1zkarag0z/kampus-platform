import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import {
  deleteContentComment,
  updateContentComment,
} from "@/server/content/service";
import {
  parseContentInput,
  updateCommentSchema,
} from "@/server/content/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/v1/comments/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseContentInput(updateCommentSchema, body);
    const { id } = await context.params;
    const comment = await updateContentComment(
      member.userId,
      id,
      input,
    );

    return NextResponse.json(
      { data: comment },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/comments/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;

    await deleteContentComment(member.userId, id);

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
