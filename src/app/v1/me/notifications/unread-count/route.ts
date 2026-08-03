import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import { authErrorResponse, noStoreHeaders } from "@/server/auth/request";
import { getUnreadNotificationCount } from "@/server/notifications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const count = await getUnreadNotificationCount(member.userId);

    return NextResponse.json(
      { data: { count } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
