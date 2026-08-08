import { NextRequest, NextResponse } from "next/server";

import {
  removeAccountAvatar,
  uploadAccountAvatar,
} from "@/server/account/service";
import {
  refreshActiveMemberSession,
  requireActiveMember,
} from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { IMAGE_MULTIPART_MAX_BYTES } from "@/lib/upload-limits";
import {
  assertSameOrigin,
  authErrorResponse,
  noStoreHeaders,
} from "@/server/auth/request";
import {
  isUploadedFile,
  readLimitedMultipartFormData,
} from "@/server/http/multipart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);
    const formData = await readLimitedMultipartFormData(request, {
      field: "image",
      invalidMessage: "Görsel yükleme isteği okunamadı.",
      maxBytes: IMAGE_MULTIPART_MAX_BYTES,
      tooLargeHint: "Daha küçük bir görsel seç.",
      tooLargeMessage: "Görsel en fazla 1 MB olabilir.",
    });

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

    await uploadAccountAvatar(member.userId, image);

    const state = await refreshActiveMemberSession(
      member.cookieValue,
    );

    return NextResponse.json(
      { data: state },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const member = await requireActiveMember(request);

    await removeAccountAvatar(member.userId);

    const state = await refreshActiveMemberSession(
      member.cookieValue,
    );

    return NextResponse.json(
      { data: state },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
