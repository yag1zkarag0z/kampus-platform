import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  authErrorResponse,
  noStoreHeaders,
  readQueryParams,
} from "@/server/auth/request";
import { parseAuthInput } from "@/server/auth/validation";
import { searchMembers } from "@/server/social/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memberSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(40),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseAuthInput(
      memberSearchQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const members = await searchMembers(member.userId, query.q);

    return NextResponse.json(
      { data: members },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
