import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { restoreUser, suspendUser } from "@/server/moderation/service";
import {
  moderationEntityIdSchema,
  parseModerationInput,
  updateUserStatusSchema,
} from "@/server/moderation/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserStatusRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: UserStatusRouteContext,
) {
  try {
    assertSameOrigin(request);
    const moderator = await requireActiveModerator(request);
    const body = await readJsonBody(request);
    const input = parseModerationInput(updateUserStatusSchema, body);
    const params = await context.params;
    const id = parseModerationInput(moderationEntityIdSchema, params.id);

    if (input.status === "suspended") {
      await suspendUser(moderator.userId, id, input.note);
    } else {
      await restoreUser(moderator.userId, id, input.note);
    }

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
