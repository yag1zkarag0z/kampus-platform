"use client";

import { requestApi, requestApiPayload } from "@/auth/client";
import type { CursorPage } from "@/components/useCursorList";

export type FeedbackCategoryDto = "bug" | "suggestion" | "other";
export type FeedbackStatusDto =
  | "new"
  | "reviewing"
  | "resolved"
  | "dismissed";

export type FeedbackSummaryDto = {
  id: string;
  category: FeedbackCategoryDto;
  message: string;
  pagePath: string;
  status: FeedbackStatusDto;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  submitter:
    | {
        kind: "member";
        id: string;
        username: string;
        displayName: string;
      }
    | { kind: "guest" }
    | { kind: "deleted_member" };
};

export function submitProductFeedback(input: {
  category: FeedbackCategoryDto;
  message: string;
  pagePath: string;
}) {
  return requestApi<{ id: string }>("/v1/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getModerationFeedback(
  filters: {
    status?: FeedbackStatusDto;
    category?: FeedbackCategoryDto;
  } = {},
  cursor?: string,
) {
  const searchParams = new URLSearchParams();

  if (filters.status) searchParams.set("status", filters.status);
  if (filters.category) searchParams.set("category", filters.category);
  if (cursor) searchParams.set("cursor", cursor);

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

  return requestApiPayload<CursorPage<FeedbackSummaryDto>>(
    `/v1/moderation/feedback${query}`,
    { cache: "no-store" },
  );
}

export function updateModerationFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatusDto,
) {
  return requestApi<{ id: string; status: FeedbackStatusDto }>(
    `/v1/moderation/feedback/${encodeURIComponent(feedbackId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
