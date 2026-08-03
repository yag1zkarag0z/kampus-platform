import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { parseTimelineQuery } from "@/server/pagination/cursor";
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
    const member = await requireActiveMember(request);
    const { username } = await context.params;
    const query = parseTimelineQuery(request.nextUrl.searchParams);
    const result = await listFollowing(member.userId, username, query);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
