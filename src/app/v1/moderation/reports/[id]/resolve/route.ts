import { NextRequest, NextResponse } from "next/server";

import { requireActiveModerator } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { resolveReport } from "@/server/moderation/service";
import {
  parseModerationInput,
  resolveReportSchema,
} from "@/server/moderation/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolveReportRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  context: ResolveReportRouteContext,
) {
  try {
    assertSameOrigin(request);
    const moderator = await requireActiveModerator(request);
    const body = await readJsonBody(request);
    const input = parseModerationInput(resolveReportSchema, body);
    const { id } = await context.params;

    await resolveReport(
      moderator.userId,
      id,
      input.resolution,
      input.note,
    );

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
