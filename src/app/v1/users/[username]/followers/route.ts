import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { listFollowers } from "@/server/social/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FollowersRouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(
  request: NextRequest,
  context: FollowersRouteContext,
) {
  try {
    await requireActiveMember(request);
    const { username } = await context.params;
    const followers = await listFollowers(username);

    return NextResponse.json(
      { data: followers },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
