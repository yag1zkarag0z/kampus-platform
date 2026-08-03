import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { parseTimelineQuery } from "@/server/pagination/cursor";
import { listManagedUsers } from "@/server/moderation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireActiveModerator(request);
    const query = parseTimelineQuery(request.nextUrl.searchParams);
    const result = await listManagedUsers(query);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
