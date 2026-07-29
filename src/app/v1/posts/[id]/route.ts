import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import {
  deleteContentPost,
  getContentPost,
  updateContentPost,
} from "@/server/content/service";
import {
  parseContentInput,
  updatePostSchema,
} from "@/server/content/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]">,
) {
  try {
    const member = await requireActiveMember(request);
    const { id } = await context.params;
    const post = await getContentPost(member.userId, id);

    return NextResponse.json(
      { data: post },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseContentInput(updatePostSchema, body);
    const { id } = await context.params;
    const post = await updateContentPost(member.userId, id, input);

    return NextResponse.json(
      { data: post },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;

    await deleteContentPost(member.userId, id);

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
