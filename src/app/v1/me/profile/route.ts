import { NextRequest, NextResponse } from "next/server";

import { updateAccountProfile } from "@/server/account/service";
import {
  parseAccountInput,
  updateProfileSchema,
} from "@/server/account/validation";
import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseAccountInput(updateProfileSchema, body);

    await updateAccountProfile(member.userId, input);

    const state = await refreshActiveMemberSession(
      member.cookieValue,
    );

    return NextResponse.json(
      { data: state },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
