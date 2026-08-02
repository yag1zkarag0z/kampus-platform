"use client";

import { requestApi } from "@/auth/client";

export type BlockedMemberDto = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function blockMember(username: string) {
  return requestApi<{ isBlocked: boolean }>(
    `/v1/users/${encodeURIComponent(username)}/block`,
    { method: "POST" },
  );
}

export function unblockMember(username: string) {
  return requestApi<{ isBlocked: boolean }>(
    `/v1/users/${encodeURIComponent(username)}/block`,
    { method: "DELETE" },
  );
}

export function getMyBlockedUsers() {
  return requestApi<BlockedMemberDto[]>("/v1/me/blocks", {
    cache: "no-store",
  });
}
