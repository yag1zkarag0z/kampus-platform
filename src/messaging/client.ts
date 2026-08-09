"use client";

import { requestApi, requestApiPayload } from "@/auth/client";
import type { CursorPage } from "@/components/useCursorList";

export type MessageMemberDto = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type DirectConversationDto = {
  id: string;
  member: MessageMemberDto;
  lastMessage: {
    id: string;
    preview: string;
    isMine: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  createdAt: string;
};

export type DirectMessageDto = {
  id: string;
  conversationId: string;
  body: string;
  isMine: boolean;
  isDeleted: boolean;
  createdAt: string;
};

export function listDirectConversations() {
  return requestApi<DirectConversationDto[]>(
    "/v1/messages/conversations",
    { cache: "no-store" },
  );
}

export function getDirectConversation(conversationId: string) {
  return requestApi<DirectConversationDto>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}`,
    { cache: "no-store" },
  );
}

export function startDirectConversation(username: string) {
  return requestApi<DirectConversationDto>(
    "/v1/messages/conversations",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
  );
}

export function listDirectMessages(
  conversationId: string,
  cursor?: string,
) {
  const searchParams = new URLSearchParams();
  if (cursor) searchParams.set("cursor", cursor);
  searchParams.set("limit", "50");

  return requestApiPayload<CursorPage<DirectMessageDto>>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages?${searchParams.toString()}`,
    { cache: "no-store" },
  );
}

export function sendDirectMessage(conversationId: string, body: string) {
  return requestApi<DirectMessageDto>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

export function markDirectConversationRead(conversationId: string) {
  return requestApi<void>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST" },
  );
}

export function deleteDirectMessage(messageId: string) {
  return requestApi<void>(
    `/v1/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" },
  );
}

export function getUnreadDirectMessageCount() {
  return requestApi<{ count: number }>("/v1/messages/unread-count", {
    cache: "no-store",
  });
}
