import { NextRequest, NextResponse } from "next/server";

import { deleteAccount, updateAccountProfile } from "@/server/account/service";
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
  clearSessionCookie,
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

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);

    await deleteAccount(member.userId);

    const response = new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
    clearSessionCookie(response);

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
