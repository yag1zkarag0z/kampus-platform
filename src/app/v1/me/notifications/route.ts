import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
  readQueryParams,
} from "@/server/auth/request";
import { listNotifications } from "@/server/notifications/service";
import {
  listNotificationsQuerySchema,
  parseNotificationsInput,
} from "@/server/notifications/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseNotificationsInput(
      listNotificationsQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const result = await listNotifications(member.userId, query);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
