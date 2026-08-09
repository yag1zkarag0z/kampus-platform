"use client";

import { requestApi, requestApiPayload } from "@/auth/client";
import type { CursorPage } from "@/components/useCursorList";

export type FollowSummaryDto = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export type PublicMemberProfileDto = FollowSummaryDto & {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  role: "member" | "moderator" | "admin";
  avatarUrl: string | null;
  joinedLabel: string;
  department: string | null;
  year: string | null;
};

export type FollowMemberDto = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type SuggestedMemberDto = FollowMemberDto & {
  department: string;
  bio: string;
};

export function getMemberProfile(username: string) {
  return requestApi<PublicMemberProfileDto>(
    `/v1/users/${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );
}

export function followMember(username: string) {
  return requestApi<FollowSummaryDto>(
    `/v1/users/${encodeURIComponent(username)}/follow`,
    { method: "POST" },
  );
}

export function unfollowMember(username: string) {
  return requestApi<FollowSummaryDto>(
    `/v1/users/${encodeURIComponent(username)}/follow`,
    { method: "DELETE" },
  );
}

function followListQuery(cursor?: string) {
  return cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
}

export function getMemberFollowers(username: string, cursor?: string) {
  return requestApiPayload<CursorPage<FollowMemberDto>>(
    `/v1/users/${encodeURIComponent(username)}/followers${followListQuery(
      cursor,
    )}`,
    { cache: "no-store" },
  );
}

export function getMemberFollowing(username: string, cursor?: string) {
  return requestApiPayload<CursorPage<FollowMemberDto>>(
    `/v1/users/${encodeURIComponent(username)}/following${followListQuery(
      cursor,
    )}`,
    { cache: "no-store" },
  );
}

export function getSuggestedFollows() {
  return requestApi<SuggestedMemberDto[]>("/v1/me/suggested-follows", {
    cache: "no-store",
  });
}

export function searchMembers(query: string) {
  const searchParams = new URLSearchParams({ q: query });

  return requestApi<FollowMemberDto[]>(
    `/v1/users/search?${searchParams.toString()}`,
    { cache: "no-store" },
  );
}
