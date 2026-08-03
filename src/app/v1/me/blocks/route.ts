import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { parseTimelineQuery } from "@/server/pagination/cursor";
import { listBlockedUsers } from "@/server/moderation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseTimelineQuery(request.nextUrl.searchParams);
    const result = await listBlockedUsers(member.userId, query);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
