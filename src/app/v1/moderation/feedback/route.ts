import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import { authErrorResponse, noStoreHeaders } from "@/server/auth/request";
import { listProductFeedback } from "@/server/feedback/service";
import {
  listFeedbackQuerySchema,
  parseFeedbackInput,
} from "@/server/feedback/validation";
import { parseTimelineQuery } from "@/server/pagination/cursor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireActiveModerator(request);
    const searchParams = request.nextUrl.searchParams;
    const filters = parseFeedbackInput(listFeedbackQuerySchema, {
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    });
    const pagination = parseTimelineQuery(
      new URLSearchParams(
        [...searchParams.entries()].filter(
          ([key]) => key !== "status" && key !== "category",
        ),
      ),
    );
    const result = await listProductFeedback(filters, pagination);

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
