import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { AuthError } from "@/server/auth/errors";
import { uploadContentDocument } from "@/server/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number"
  );
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 8_400_000) {
      throw new AuthError(
        "INVALID_REQUEST",
        "Doküman en fazla 8 MB olabilir.",
        {
          fieldErrors: { document: ["Daha küçük bir dosya seç."] },
          status: 413,
        },
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      throw new AuthError(
        "INVALID_REQUEST",
        "Doküman yükleme isteği okunamadı.",
        { status: 400 },
      );
    }

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
