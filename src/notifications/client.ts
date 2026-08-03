"use client";

import { requestApi, requestApiPayload } from "@/auth/client";
import type { CursorPage } from "@/components/useCursorList";

export type NotificationKindDto =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "announcement";

export type NotificationActorDto = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type NotificationDto = {
  id: string;
  kind: NotificationKindDto;
  actor: NotificationActorDto;
  likeCount: number | null;
  post: { id: string; title: string; isDeleted: boolean } | null;
  comment: { id: string; excerpt: string; isDeleted: boolean } | null;
  isRead: boolean;
  createdAt: string;
};

export function getMyNotifications({
  cursor,
  limit,
}: { cursor?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams();

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  if (limit) {
    searchParams.set("limit", String(limit));
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

  return requestApiPayload<CursorPage<NotificationDto>>(
    `/v1/me/notifications${query}`,
    { cache: "no-store" },
  );
}

export function getMyUnreadNotificationCount() {
  return requestApi<{ count: number }>("/v1/me/notifications/unread-count", {
    cache: "no-store",
  });
}

export function markNotificationRead(notificationId: string) {
  return requestApi<void>(
    `/v1/me/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}

export function markAllNotificationsRead() {
  return requestApi<{ markedCount: number }>(
    "/v1/me/notifications/read-all",
    { method: "POST" },
  );
}
