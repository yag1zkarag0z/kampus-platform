import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { recordAnalyticsEvent } from "@/server/analytics/service";
import {
  followUser,
  getFollowSummary,
  unfollowUser,
} from "@/server/social/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FollowRouteContext = {
  params: Promise<{ username: string }>;
};

export async function POST(
  request: NextRequest,
  context: FollowRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { username } = await context.params;

    const created = await followUser(member.userId, username);
    const summary = await getFollowSummary(member.userId, username);

    if (created) {
      await recordAnalyticsEvent("follow_created", {
        userId: member.userId,
      });
    }

    return NextResponse.json(
      { data: summary },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: FollowRouteContext,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { username } = await context.params;

    await unfollowUser(member.userId, username);
    const summary = await getFollowSummary(member.userId, username);

    return NextResponse.json(
      { data: summary },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
