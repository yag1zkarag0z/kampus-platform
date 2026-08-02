import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
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
    const { status } = parseModerationInput(listReportsQuerySchema, {
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    });
    const reports = await listReports(status);

    return NextResponse.json(
      { data: reports },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
