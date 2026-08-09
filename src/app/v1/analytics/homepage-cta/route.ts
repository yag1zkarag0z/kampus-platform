import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  HOMEPAGE_CTA_SOURCES,
  HOMEPAGE_CTA_TARGETS,
} from "@/analytics/homepageEvents";
import { AuthError } from "@/server/auth/errors";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
} from "@/server/auth/request";
import { logEvent } from "@/server/observability/logger";
import { requestIdFromRequest } from "@/server/observability/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const homepageCtaEventSchema = z
  .object({
    event: z.literal("homepage_cta_click"),
    source: z.enum(HOMEPAGE_CTA_SOURCES),
    target: z.enum(HOMEPAGE_CTA_TARGETS),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = homepageCtaEventSchema.safeParse(
      await readJsonBody(request),
    );

    if (!parsed.success) {
      throw new AuthError(
        "INVALID_REQUEST",
        "Analytics olayı geçersiz.",
        { status: 400 },
      );
    }

    logEvent("info", "analytics.homepage_cta_clicked", {
      requestId: requestIdFromRequest(request),
      source: parsed.data.source,
      target: parsed.data.target,
    });

    return NextResponse.json(
      { data: { accepted: true } },
      { status: 202, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
