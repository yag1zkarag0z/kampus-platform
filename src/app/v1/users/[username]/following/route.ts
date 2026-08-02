import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { listFollowing } from "@/server/social/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FollowingRouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(
  request: NextRequest,
  context: FollowingRouteContext,
) {
  try {
    await requireActiveMember(request);
    const { username } = await context.params;
    const following = await listFollowing(username);

    return NextResponse.json(
      { data: following },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
