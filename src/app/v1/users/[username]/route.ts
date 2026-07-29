import { NextRequest, NextResponse } from "next/server";

import { getPublicAccountProfile } from "@/server/account/service";
import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(
  request: NextRequest,
  context: UserRouteContext,
) {
  try {
    await requireActiveMember(request);
    const { username } = await context.params;
    const profile = await getPublicAccountProfile(username);

    return NextResponse.json(
      { data: profile },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
