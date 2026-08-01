import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { voteInContentPoll } from "@/server/content/service";
import {
  parseContentInput,
  votePollSchema,
} from "@/server/content/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/v1/polls/[id]/vote">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const { optionId } = parseContentInput(votePollSchema, body);
    const { id } = await context.params;
    const post = await voteInContentPoll(member.userId, id, optionId);

    return NextResponse.json(
      { data: post },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
