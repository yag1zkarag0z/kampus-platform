import { NextRequest, NextResponse } from "next/server";

import { requireActiveAdmin } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { setUserRole } from "@/server/moderation/service";
import {
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
    const admin = await requireActiveAdmin(request);
    const body = await readJsonBody(request);
    const input = parseModerationInput(updateUserRoleSchema, body);
    const { id } = await context.params;

    await setUserRole(admin.userId, id, input.role);

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
