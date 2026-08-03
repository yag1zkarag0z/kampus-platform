import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { parseTimelineQuery } from "@/server/pagination/cursor";
import { listReports } from "@/server/moderation/service";
import {
  listReportsQuerySchema,
  parseModerationInput,
} from "@/server/moderation/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireActiveModerator(request);
    const searchParams = request.nextUrl.searchParams;
    const { status } = parseModerationInput(listReportsQuerySchema, {
      status: searchParams.get("status") ?? undefined,
    });
    const pagination = parseTimelineQuery(
      new URLSearchParams(
        [...searchParams.entries()].filter(([key]) => key !== "status"),
      ),
    );
    const result = await listReports(status, pagination);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
