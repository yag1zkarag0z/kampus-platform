import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRealtimeReconnectDelayMs,
} from "@/components/CampusRealtimeProvider";
import {
  parseRealtimeBrokerEvent,
  parseRealtimeClientMessage,
  parseRealtimeServerEvent,
  REALTIME_PROTOCOL_VERSION,
} from "@/realtime/protocol";

const conversationId = "11111111-1111-4111-8111-111111111111";
const firstUserId = "22222222-2222-4222-8222-222222222222";
const secondUserId = "33333333-3333-4333-8333-333333333333";

afterEach(() => vi.restoreAllMocks());

describe("realtime protocol", () => {
  it("accepts only bounded client events", () => {
    expect(
      parseRealtimeClientMessage({
        type: "typing",
        conversationId,
        isTyping: true,
      }),
    ).toEqual({ type: "typing", conversationId, isTyping: true });
    expect(
      parseRealtimeClientMessage({
        type: "typing",
        conversationId: "not-a-uuid",
        isTyping: true,
      }),
    ).toBeNull();
    expect(
      parseRealtimeClientMessage({
        type: "typing",
        conversationId,
        isTyping: "yes",
      }),
    ).toBeNull();
  });

  it("parses server and PostgreSQL broker events without exposing recipients", () => {
    const broker = parseRealtimeBrokerEvent({
      version: REALTIME_PROTOCOL_VERSION,
      type: "conversation.invalidate",
      conversationId,
      reason: "message-created",
      userIds: [firstUserId, secondUserId],
    });
    expect(broker).toMatchObject({
      conversationId,
      reason: "message-created",
      userIds: [firstUserId, secondUserId],
    });
    expect(
      parseRealtimeServerEvent({
        type: "conversation.invalidate",
        conversationId,
        reason: "message-created",
      }),
    ).toEqual({
      type: "conversation.invalidate",
      conversationId,
      reason: "message-created",
    });
    expect(
      parseRealtimeServerEvent({
        type: "conversation.invalidate",
        conversationId,
        reason: "unknown",
        userIds: [firstUserId],
      }),
    ).toBeNull();
  });

  it("uses capped exponential reconnect delays with jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRealtimeReconnectDelayMs(0)).toBe(1_000);
    expect(getRealtimeReconnectDelayMs(3)).toBe(8_000);
    expect(getRealtimeReconnectDelayMs(20)).toBe(30_000);
  });
});
