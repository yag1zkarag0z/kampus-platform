import { NextRequest } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import {
  deleteUnattachedContentImage,
  getVisibleContentImage,
} from "@/server/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/v1/media/[id]">,
) {
  try {
    await requireActiveMember(request);
    const { id } = await context.params;
    const image = await getVisibleContentImage(id);

    return new Response(new Uint8Array(image.body), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/media/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;

    await deleteUnattachedContentImage(member.userId, id);

    return new Response(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
