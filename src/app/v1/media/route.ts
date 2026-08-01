import { NextRequest, NextResponse } from "next/server";

import { requireActiveMember } from "@/server/auth/authorization";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import { AuthError } from "@/server/auth/errors";
import { uploadContentImage } from "@/server/media/service";

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

    if (contentLength > 1_250_000) {
      throw new AuthError(
        "INVALID_REQUEST",
        "İşlenmiş görsel en fazla 1 MB olabilir.",
        { fieldErrors: { image: ["Daha küçük bir görsel seç."] }, status: 413 },
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      throw new AuthError(
        "INVALID_REQUEST",
        "Görsel yükleme isteği okunamadı.",
        { status: 400 },
      );
    }

    const fields = [...formData.keys()];
    const image = formData.get("image");

    if (
      fields.length !== 1 ||
      fields[0] !== "image" ||
      !isUploadedFile(image)
    ) {
      throw new AuthError(
        "INVALID_REQUEST",
        "Tek bir görsel dosyası göndermelisin.",
        { fieldErrors: { image: ["Görsel dosyası eksik veya geçersiz."] }, status: 400 },
      );
    }

    const asset = await uploadContentImage(member.userId, image);

    return NextResponse.json(
      { data: asset },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
