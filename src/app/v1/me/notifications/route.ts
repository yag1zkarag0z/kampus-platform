import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import { authErrorResponse, noStoreHeaders } from "@/server/auth/request";
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
    const { limit } = parseNotificationsInput(listNotificationsQuerySchema, {
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });
    const notifications = await listNotifications(member.userId, limit);

    return NextResponse.json(
      { data: notifications },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
