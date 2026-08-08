import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { AuthError } from "@/server/auth/errors";
import { DOCUMENT_MULTIPART_MAX_BYTES } from "@/lib/upload-limits";
import {
  isUploadedFile,
  readLimitedMultipartFormData,
} from "@/server/http/multipart";
import { uploadContentDocument } from "@/server/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const formData = await readLimitedMultipartFormData(request, {
      field: "document",
      invalidMessage: "Doküman yükleme isteği okunamadı.",
      maxBytes: DOCUMENT_MULTIPART_MAX_BYTES,
      tooLargeHint: "Daha küçük bir dosya seç.",
      tooLargeMessage: "Doküman en fazla 8 MB olabilir.",
    });

    const fields = [...formData.keys()];
    const document = formData.get("document");

    if (
      fields.length !== 1 ||
      fields[0] !== "document" ||
      !isUploadedFile(document)
    ) {
      throw new AuthError(
        "INVALID_REQUEST",
        "Tek bir doküman dosyası göndermelisin.",
        {
          fieldErrors: { document: ["Doküman dosyası eksik veya geçersiz."] },
          status: 400,
        },
      );
    }

    const asset = await uploadContentDocument(member.userId, document);

    return NextResponse.json(
      { data: asset },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
