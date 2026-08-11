import { describe, expect, it } from "vitest";

import { AuthError } from "@/server/auth/errors";

import {
  parseFeedbackInput,
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
} from "./validation";

describe("feedback validation", () => {
  it("normalizes a valid submission", () => {
    expect(
      parseFeedbackInput(submitFeedbackSchema, {
        category: "suggestion",
        message: "  Arama sonucunda bölüm filtresi de olabilir.  ",
        pagePath: "/kesfet",
      }),
    ).toEqual({
      category: "suggestion",
      message: "Arama sonucunda bölüm filtresi de olabilir.",
      pagePath: "/kesfet",
    });
  });

  it("rejects short messages, external paths and unknown fields", () => {
    for (const input of [
      { category: "bug", message: "Çok kısa", pagePath: "/akis" },
      {
        category: "other",
        message: "Bu mesaj yeterince uzun bir geri bildirim.",
        pagePath: "https://attacker.example",
      },
      {
        category: "other",
        message: "Bu mesaj yeterince uzun bir geri bildirim.",
        pagePath: "/akis",
        userId: "override",
      },
    ]) {
      expect(() => parseFeedbackInput(submitFeedbackSchema, input)).toThrow(
        AuthError,
      );
    }
  });

  it("accepts only known moderation states", () => {
    expect(
      parseFeedbackInput(updateFeedbackStatusSchema, {
        status: "resolved",
      }),
    ).toEqual({ status: "resolved" });
    expect(() =>
      parseFeedbackInput(updateFeedbackStatusSchema, { status: "deleted" }),
    ).toThrow(AuthError);
  });
});
