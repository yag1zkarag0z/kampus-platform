import { NextRequest, NextResponse } from "next/server";

import { requireRecentActiveAdmin } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { setUserRole } from "@/server/moderation/service";
import {
  moderationEntityIdSchema,
  parseModerationInput,
  updateUserRoleSchema,
} from "@/server/moderation/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRoleRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: UserRoleRouteContext,
) {
  try {
    assertSameOrigin(request);
    const admin = await requireRecentActiveAdmin(request);
    const body = await readJsonBody(request);
    const input = parseModerationInput(updateUserRoleSchema, body);
    const params = await context.params;
    const id = parseModerationInput(moderationEntityIdSchema, params.id);

    await setUserRole(admin.userId, id, input.role, input.note);

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
