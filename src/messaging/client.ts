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
  requestStatus: "pending" | "accepted";
  requestDirection: "incoming" | "outgoing" | null;
  createdAt: string;
};

export type DirectMessageDto = {
  id: string;
  conversationId: string;
  body: string;
  isMine: boolean;
  isDeleted: boolean;
  isSeen?: boolean;
  createdAt: string;
};

export function listDirectConversations(
  box: "inbox" | "requests" = "inbox",
  cursor?: string,
  search?: string,
) {
  const searchParams = new URLSearchParams({ box, limit: "20" });
  if (cursor) searchParams.set("cursor", cursor);
  if (search?.trim()) searchParams.set("search", search.trim());

  return requestApiPayload<CursorPage<DirectConversationDto>>(
    `/v1/messages/conversations?${searchParams.toString()}`,
    { cache: "no-store" },
  );
}

export function resolveDirectMessageRequest(
  conversationId: string,
  action: "accept" | "delete" | "block",
) {
  return requestApi<DirectConversationDto | void>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/request`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
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

export function sendDirectMessage(
  conversationId: string,
  body: string,
  clientMessageId: string,
) {
  return requestApi<DirectMessageDto>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body, clientMessageId }),
    },
  );
}

export function markDirectConversationRead(
  conversationId: string,
  messageId: string,
) {
  return requestApi<void>(
    `/v1/messages/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", body: JSON.stringify({ messageId }) },
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
