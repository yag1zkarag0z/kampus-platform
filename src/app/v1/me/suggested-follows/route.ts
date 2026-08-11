import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
  readQueryParams,
} from "@/server/auth/request";
import { parseAuthInput } from "@/server/auth/validation";
import { limitFieldSchema } from "@/server/pagination/cursor";
import {
  getSuggestedMembers,
  SUGGESTION_MAX_LIMIT,
} from "@/server/social/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sağ ray dört, /takip sayfası yirmi öneri istiyor; limit olmadan ikisi de
// servisin varsayılanına düşüyordu.
const suggestedFollowsQuerySchema = z
  .object({
    limit: limitFieldSchema({
      defaultLimit: 8,
      maxLimit: SUGGESTION_MAX_LIMIT,
    }),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseAuthInput(
      suggestedFollowsQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const suggestions = await getSuggestedMembers(member.userId, query.limit);

    return NextResponse.json(
      { data: suggestions },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
