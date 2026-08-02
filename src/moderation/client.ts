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

export type ReportReasonDto =
  | "spam"
  | "harassment"
  | "personal_information"
  | "misleading"
  | "other";
export type ReportTargetTypeDto = "post" | "comment";
export type ReportResolutionDto =
  | "dismissed"
  | "content_removed"
  | "user_suspended";

export type ReportSummaryDto = {
  id: string;
  targetType: ReportTargetTypeDto;
  targetId: string;
  postId: string;
  reason: ReportReasonDto;
  detail: string;
  status: "pending" | "resolved";
  resolution: ReportResolutionDto | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; username: string; displayName: string };
  target: {
    authorId: string;
    author: { username: string; displayName: string } | null;
    excerpt: string;
    isDeleted: boolean;
  };
};

export type ManagedUserDto = {
  id: string;
  username: string;
  displayName: string;
  department: string;
  role: "member" | "moderator" | "admin";
  status: "active" | "suspended";
  suspendedAt: string | null;
  joinedLabel: string;
  avatarUrl: string | null;
};

export type ModerationHistoryEntryDto = {
  id: string;
  action:
    | "report_dismissed"
    | "content_removed"
    | "user_suspended"
    | "user_restored"
    | "role_changed";
  createdAt: string;
  reportId: string | null;
  postId: string | null;
  note: string | null;
  actor: { username: string; displayName: string };
  target: { id: string; username: string; displayName: string } | null;
};

export function submitReport(input: {
  targetType: ReportTargetTypeDto;
  targetId: string;
  reason: ReportReasonDto;
  detail?: string;
}) {
  return requestApi<{ created: boolean }>("/v1/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getModerationReports(status?: "pending" | "resolved") {
  const searchParams = status ? `?status=${status}` : "";

  return requestApi<ReportSummaryDto[]>(
    `/v1/moderation/reports${searchParams}`,
    { cache: "no-store" },
  );
}

export function resolveModerationReport(
  reportId: string,
  input: { resolution: ReportResolutionDto; note?: string },
) {
  return requestApi<void>(
    `/v1/moderation/reports/${encodeURIComponent(reportId)}/resolve`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getManagedUsers() {
  return requestApi<ManagedUserDto[]>("/v1/moderation/users", {
    cache: "no-store",
  });
}

export function updateUserStatus(
  userId: string,
  input: { status: "active" | "suspended"; note?: string },
) {
  return requestApi<void>(
    `/v1/moderation/users/${encodeURIComponent(userId)}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function updateUserRole(
  userId: string,
  role: "member" | "moderator" | "admin",
) {
  return requestApi<void>(
    `/v1/moderation/users/${encodeURIComponent(userId)}/role`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  );
}

export function getModerationHistory() {
  return requestApi<ModerationHistoryEntryDto[]>(
    "/v1/moderation/history",
    { cache: "no-store" },
  );
}
