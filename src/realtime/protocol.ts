export const REALTIME_PATH = "/v1/realtime";
export const REALTIME_POSTGRES_CHANNEL = "kampus_realtime_v1";

export const REALTIME_PROTOCOL_VERSION = 1 as const;

export type ConversationInvalidationReason =
  | "conversation-started"
  | "message-created"
  | "message-deleted"
  | "message-read"
  | "request-accepted"
  | "request-removed";

export type RealtimeClientMessage =
  | {
      type: "conversation.subscribe";
      conversationId: string;
    }
  | {
      type: "conversation.unsubscribe";
      conversationId: string;
    }
  | {
      type: "typing";
      conversationId: string;
      isTyping: boolean;
    };

export type RealtimeServerEvent =
  | {
      type: "ready";
      version: typeof REALTIME_PROTOCOL_VERSION;
    }
  | {
      type: "conversation.invalidate";
      conversationId: string;
      reason: ConversationInvalidationReason;
    }
  | {
      type: "typing";
      conversationId: string;
      userId: string;
      isTyping: boolean;
    };

export type RealtimeBrokerEvent =
  | {
      version: typeof REALTIME_PROTOCOL_VERSION;
      type: "conversation.invalidate";
      conversationId: string;
      reason: ConversationInvalidationReason;
      userIds: string[];
    }
  | {
      version: typeof REALTIME_PROTOCOL_VERSION;
      type: "typing";
      conversationId: string;
      userId: string;
      isTyping: boolean;
      userIds: string[];
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INVALIDATION_REASONS = new Set<ConversationInvalidationReason>([
  "conversation-started",
  "message-created",
  "message-deleted",
  "message-read",
  "request-accepted",
  "request-removed",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseRealtimeClientMessage(
  value: unknown,
): RealtimeClientMessage | null {
  if (!isObject(value) || !isUuid(value.conversationId)) return null;

  if (
    value.type === "conversation.subscribe" ||
    value.type === "conversation.unsubscribe"
  ) {
    return {
      type: value.type,
      conversationId: value.conversationId,
    };
  }

  if (value.type === "typing" && typeof value.isTyping === "boolean") {
    return {
      type: "typing",
      conversationId: value.conversationId,
      isTyping: value.isTyping,
    };
  }

  return null;
}

export function parseRealtimeServerEvent(
  value: unknown,
): RealtimeServerEvent | null {
  if (!isObject(value)) return null;

  if (
    value.type === "ready" &&
    value.version === REALTIME_PROTOCOL_VERSION
  ) {
    return { type: "ready", version: REALTIME_PROTOCOL_VERSION };
  }

  if (
    value.type === "conversation.invalidate" &&
    isUuid(value.conversationId) &&
    typeof value.reason === "string" &&
    INVALIDATION_REASONS.has(value.reason as ConversationInvalidationReason)
  ) {
    return {
      type: "conversation.invalidate",
      conversationId: value.conversationId,
      reason: value.reason as ConversationInvalidationReason,
    };
  }

  if (
    value.type === "typing" &&
    isUuid(value.conversationId) &&
    isUuid(value.userId) &&
    typeof value.isTyping === "boolean"
  ) {
    return {
      type: "typing",
      conversationId: value.conversationId,
      userId: value.userId,
      isTyping: value.isTyping,
    };
  }

  return null;
}

export function parseRealtimeBrokerEvent(
  value: unknown,
): RealtimeBrokerEvent | null {
  if (
    !isObject(value) ||
    value.version !== REALTIME_PROTOCOL_VERSION ||
    !isUuid(value.conversationId) ||
    !Array.isArray(value.userIds) ||
    value.userIds.length === 0 ||
    value.userIds.length > 2 ||
    !value.userIds.every(isUuid)
  ) {
    return null;
  }

  const userIds = [...new Set(value.userIds)];

  if (
    value.type === "conversation.invalidate" &&
    typeof value.reason === "string" &&
    INVALIDATION_REASONS.has(value.reason as ConversationInvalidationReason)
  ) {
    return {
      version: REALTIME_PROTOCOL_VERSION,
      type: "conversation.invalidate",
      conversationId: value.conversationId,
      reason: value.reason as ConversationInvalidationReason,
      userIds,
    };
  }

  if (
    value.type === "typing" &&
    isUuid(value.userId) &&
    typeof value.isTyping === "boolean"
  ) {
    return {
      version: REALTIME_PROTOCOL_VERSION,
      type: "typing",
      conversationId: value.conversationId,
      userId: value.userId,
      isTyping: value.isTyping,
      userIds,
    };
  }

  return null;
}
