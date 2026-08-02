import { NextRequest, NextResponse } from "next/server";

import { getPublicAccountProfile } from "@/server/account/service";
import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { getFollowSummary } from "@/server/social/service";

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
    const member = await requireActiveMember(request);
    const { username } = await context.params;
    const [profile, followSummary] = await Promise.all([
      getPublicAccountProfile(username),
      getFollowSummary(member.userId, username),
    ]);

    return NextResponse.json(
      { data: { ...profile, ...followSummary } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
