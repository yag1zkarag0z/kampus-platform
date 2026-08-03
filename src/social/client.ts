"use client";

import { requestApi } from "@/auth/client";

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

export function getMemberFollowers(username: string) {
  return requestApi<FollowMemberDto[]>(
    `/v1/users/${encodeURIComponent(username)}/followers`,
    { cache: "no-store" },
  );
}

export function getMemberFollowing(username: string) {
  return requestApi<FollowMemberDto[]>(
    `/v1/users/${encodeURIComponent(username)}/following`,
    { cache: "no-store" },
  );
}

export function getSuggestedFollows() {
  return requestApi<SuggestedMemberDto[]>("/v1/me/suggested-follows", {
    cache: "no-store",
  });
}
