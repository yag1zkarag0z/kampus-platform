import { NextRequest } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import {
  deleteUnattachedContentDocument,
  getVisibleContentDocument,
} from "@/server/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/v1/media/documents/[id]">,
) {
  try {
    await requireActiveMember(request);
    const { id } = await context.params;
    const document = await getVisibleContentDocument(id);
    const safeFileName = document.fileName.replaceAll('"', "'");

    return new Response(new Uint8Array(document.body), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": document.contentType,
        // Satır içi değil, indirilerek açılsın: gömülü içerikli "polyglot"
        // bir PDF, aynı origin'de satır içi açılırsa tarayıcı çerezlerine
        // erişim vektörü olabilir.
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/v1/media/documents/[id]">,
) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const { id } = await context.params;

    await deleteUnattachedContentDocument(member.userId, id);

    return new Response(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    return authErrorResponse(error);
  }
}
