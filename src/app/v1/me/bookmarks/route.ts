import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
  readQueryParams,
} from "@/server/auth/request";
import { listContentBookmarks } from "@/server/content/service";
import {
  bookmarksQuerySchema,
  parseContentInput,
} from "@/server/content/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseContentInput(
      bookmarksQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const result = await listContentBookmarks(member.userId, query);

    return NextResponse.json(result, {
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
