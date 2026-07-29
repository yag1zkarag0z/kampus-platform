"use client";

import { requestApi, requestApiPayload } from "@/auth/client";

import type {
  ContentCommentDto,
  ContentPostCategory,
  ContentPostDetailDto,
  ContentPostListDto,
} from "./types";

export type CoreContentPostCategory = Exclude<
  ContentPostCategory,
  "listing" | "poll"
>;

export function listContentPosts({
  category,
  author,
  cursor,
  limit = 50,
}: {
  category?: CoreContentPostCategory;
  author?: string;
  cursor?: string;
  limit?: number;
} = {}) {
  const searchParams = new URLSearchParams({
    sort: "newest",
    limit: String(limit),
  });

  if (category) {
    searchParams.set("category", category);
  }

  if (author) {
    searchParams.set("author", author);
  }

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return requestApiPayload<ContentPostListDto>(
    `/v1/posts?${searchParams.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function getContentPost(postId: string) {
  return requestApi<ContentPostDetailDto>(`/v1/posts/${postId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export function createContentPost(input: {
  category: CoreContentPostCategory;
  title: string;
  body: string;
  isAnonymous: boolean;
}) {
  return requestApi<ContentPostDetailDto>("/v1/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateContentPost(
  postId: string,
  input: {
    title: string;
    body: string;
  },
) {
  return requestApi<ContentPostDetailDto>(`/v1/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteContentPost(postId: string) {
  return requestApi<void>(`/v1/posts/${postId}`, {
    method: "DELETE",
  });
}

export function createContentComment(
  postId: string,
  input: {
    body: string;
    isAnonymous: boolean;
    parentId?: string;
  },
) {
  return requestApi<ContentCommentDto>(
    `/v1/posts/${postId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateContentComment(
  commentId: string,
  body: string,
) {
  return requestApi<ContentCommentDto>(
    `/v1/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    },
  );
}

export function deleteContentComment(commentId: string) {
  return requestApi<void>(`/v1/comments/${commentId}`, {
    method: "DELETE",
  });
}
