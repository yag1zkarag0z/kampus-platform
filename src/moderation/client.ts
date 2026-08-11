"use client";

import { requestApi, requestApiPayload } from "@/auth/client";
import type { CursorPage } from "@/components/useCursorList";

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

function cursorQuery(cursor?: string, extra?: string) {
  const searchParams = new URLSearchParams(extra);

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return searchParams.size > 0 ? `?${searchParams.toString()}` : "";
}

export function getMyBlockedUsers(cursor?: string) {
  return requestApiPayload<CursorPage<BlockedMemberDto>>(
    `/v1/me/blocks${cursorQuery(cursor)}`,
    { cache: "no-store" },
  );
}

export type ReportReasonDto =
  | "spam"
  | "harassment"
  | "personal_information"
  | "misleading"
  | "other";
export type ReportTargetTypeDto = "post" | "comment" | "message";
export type ReportResolutionDto =
  | "dismissed"
  | "content_removed"
  | "user_suspended";

export type ReportSummaryDto = {
  id: string;
  targetType: ReportTargetTypeDto;
  targetId: string;
  postId: string | null;
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
    | "content_hidden"
    | "content_restored"
    | "user_suspended"
    | "user_restored"
    | "role_changed";
  createdAt: string;
  reportId: string | null;
  postId: string | null;
  messageId: string | null;
  note: string | null;
  actor: { username: string; displayName: string } | null;
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

export function getModerationReports(
  status?: "pending" | "resolved",
  cursor?: string,
) {
  return requestApiPayload<CursorPage<ReportSummaryDto>>(
    `/v1/moderation/reports${cursorQuery(
      cursor,
      status ? `status=${status}` : undefined,
    )}`,
    { cache: "no-store" },
  );
}

export function resolveModerationReport(
  reportId: string,
  input: { resolution: ReportResolutionDto; note: string },
) {
  return requestApi<void>(
    `/v1/moderation/reports/${encodeURIComponent(reportId)}/resolve`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getManagedUsers(cursor?: string) {
  return requestApiPayload<CursorPage<ManagedUserDto>>(
    `/v1/moderation/users${cursorQuery(cursor)}`,
    { cache: "no-store" },
  );
}

export function updateUserStatus(
  userId: string,
  input: { status: "active" | "suspended"; note: string },
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

export function getModerationHistory(cursor?: string) {
  return requestApiPayload<CursorPage<ModerationHistoryEntryDto>>(
    `/v1/moderation/history${cursorQuery(cursor)}`,
    { cache: "no-store" },
  );
}
