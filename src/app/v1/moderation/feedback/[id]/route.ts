import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { updateProductFeedbackStatus } from "@/server/feedback/service";
import {
  feedbackIdSchema,
  parseFeedbackInput,
  updateFeedbackStatusSchema,
} from "@/server/feedback/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: FeedbackRouteContext,
) {
  try {
    assertSameOrigin(request);
    const moderator = await requireActiveModerator(request);
    const input = parseFeedbackInput(
      updateFeedbackStatusSchema,
      await readJsonBody(request),
    );
    const params = await context.params;
    const feedbackId = parseFeedbackInput(feedbackIdSchema, params.id);
    const result = await updateProductFeedbackStatus(
      moderator.userId,
      feedbackId,
      input.status,
    );

    return NextResponse.json(
      { data: result },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
