import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
  readQueryParams,
} from "@/server/auth/request";
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
    const rawQuery = readQueryParams(searchParams);
    const filters = parseFeedbackInput(listFeedbackQuerySchema, {
      status: rawQuery.status,
      category: rawQuery.category,
    });
    const pagination = parseTimelineQuery(
      new URLSearchParams(
        Object.entries(rawQuery).filter(
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
