import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { recordAnalyticsEvent } from "@/server/analytics/service";
import { createContentComment } from "@/server/content/service";
import {
  createCommentSchema,
  parseContentInput,
} from "@/server/content/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/v1/posts/[id]/comments">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseContentInput(createCommentSchema, body);
    const { id } = await context.params;
    const comment = await createContentComment(
      member.userId,
      id,
      input,
    );

    await recordAnalyticsEvent("comment_created", {
      userId: member.userId,
      props: { isReply: Boolean(input.parentId) },
    });

    const response = NextResponse.json(
      { data: comment },
      {
        status: 201,
        headers: noStoreHeaders,
      },
    );

    response.headers.set(
      "Location",
      `/v1/comments/${comment.id}`,
    );

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
