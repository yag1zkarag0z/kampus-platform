"use client";

import { requestApi, requestApiPayload } from "@/auth/client";

import type {
  ContentCommentDto,
  ContentPostCategory,
  ContentListingDto,
  ContentImageUploadDto,
  ContentPostDetailDto,
  ContentPostListDto,
  ContentPostDto,
} from "./types";

export type CoreContentPostCategory = ContentPostCategory;

export function listContentPosts({
  category,
  author,
  cursor,
  limit = 50,
  sort = "newest",
  scope = "global",
}: {
  category?: CoreContentPostCategory;
  author?: string;
  cursor?: string;
  limit?: number;
  sort?: "newest" | "popular";
  scope?: "global" | "following";
} = {}) {
  const searchParams = new URLSearchParams({
    sort,
    scope,
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

export function listContentBookmarks({
  cursor,
  limit = 20,
}: {
  cursor?: string;
  limit?: number;
} = {}) {
  const searchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return requestApiPayload<ContentPostListDto>(
    `/v1/me/bookmarks?${searchParams.toString()}`,
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
  pollOptions?: string[];
  listing?: ContentListingDto;
  imageId?: string;
  gifId?: string;
}) {
  return requestApi<ContentPostDetailDto>("/v1/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uploadContentImage(image: Blob) {
  const formData = new FormData();
  formData.set("image", image, "campus-image.webp");

  return requestApi<ContentImageUploadDto>("/v1/media", {
    method: "POST",
    body: formData,
  });
}

export function deleteUnattachedContentImage(imageId: string) {
  return requestApi<void>(`/v1/media/${imageId}`, {
    method: "DELETE",
  });
}

export function voteInContentPoll(pollId: string, optionId: string) {
  return requestApi<ContentPostDto>(`/v1/polls/${pollId}/vote`, {
    method: "PUT",
    body: JSON.stringify({ optionId }),
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

export function setContentPostLike(postId: string, liked: boolean) {
  return requestApi<ContentPostDto>(`/v1/posts/${postId}/like`, {
    method: liked ? "PUT" : "DELETE",
  });
}

export function setContentPostBookmark(
  postId: string,
  bookmarked: boolean,
) {
  return requestApi<ContentPostDto>(
    `/v1/posts/${postId}/bookmark`,
    {
      method: bookmarked ? "PUT" : "DELETE",
    },
  );
}

export function createContentComment(
  postId: string,
  input: {
    body: string;
    isAnonymous: boolean;
    parentId?: string;
    gifId?: string;
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
