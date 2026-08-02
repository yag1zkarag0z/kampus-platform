import { NextRequest } from "next/server";

import { getAccountAvatar } from "@/server/account/service";
import { requireActiveMember } from "@/server/auth/authorization";
import { authErrorResponse } from "@/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserAvatarRouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(
  request: NextRequest,
  context: UserAvatarRouteContext,
) {
  try {
    await requireActiveMember(request);
    const { username } = await context.params;
    const avatar = await getAccountAvatar(username);

    return new Response(new Uint8Array(avatar.body), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": avatar.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
