import { NextRequest, NextResponse } from "next/server";

import { recordAnalyticsEvent } from "@/server/analytics/service";
import {
  createContentPost,
  listContentPosts,
} from "@/server/content/service";
import {
  createPostSchema,
  feedQuerySchema,
  parseContentInput,
} from "@/server/content/validation";
import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
  readJsonBody,
  readQueryParams,
} from "@/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const member = await requireActiveMember(request);
    const query = parseContentInput(
      feedQuerySchema,
      readQueryParams(request.nextUrl.searchParams),
    );
    const result = await listContentPosts(member.userId, query);

    return NextResponse.json(result, {
      headers: noStoreHeaders,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const body = await readJsonBody(request);
    const input = parseContentInput(createPostSchema, body);
    const post = await createContentPost(member.userId, input);

    // Ölçüm commit'ten sonra ve beklenmeden: paylaşım başarılıysa gönderi
    // atılmış sayılır, olay kaydı düşse bile.
    void recordAnalyticsEvent("post_created", {
      userId: member.userId,
      props: {
        category: input.category,
        isAnonymous: Boolean(input.isAnonymous),
      },
    });

    const response = NextResponse.json(
      { data: post },
      {
        status: 201,
        headers: noStoreHeaders,
      },
    );

    response.headers.set("Location", `/v1/posts/${post.id}`);

    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
