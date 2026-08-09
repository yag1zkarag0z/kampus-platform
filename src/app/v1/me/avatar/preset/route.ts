import { NextRequest, NextResponse } from "next/server";

import { setAccountAvatarPreset } from "@/server/account/service";
import {
  parseAccountInput,
  updateAvatarPresetSchema,
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

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const input = parseAccountInput(
      updateAvatarPresetSchema,
      await readJsonBody(request),
    );

    await setAccountAvatarPreset(member.userId, input.presetId);
    const state = await refreshActiveMemberSession(member.cookieValue);

    return NextResponse.json(
      { data: state },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
