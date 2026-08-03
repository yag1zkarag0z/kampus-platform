import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestApi, requestApiPayload } from "@/auth/client";

import {
  createContentComment,
  createContentPost,
  deleteContentComment,
  deleteContentPost,
  getContentPost,
  listContentPosts,
  uploadContentImage,
  setContentPostBookmark,
  setContentPostLike,
  updateContentComment,
  updateContentPost,
} from "./client";

vi.mock("@/auth/client", () => ({
  requestApi: vi.fn(),
  requestApiPayload: vi.fn(),
}));

const mockedRequestApi = vi.mocked(requestApi);
const mockedRequestApiPayload = vi.mocked(requestApiPayload);
const postId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const commentId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
const parentId = "69d1eaf2-2bd9-4f99-82fb-a4480ea782db";

describe("content API client", () => {
  beforeEach(() => {
    mockedRequestApi.mockReset().mockResolvedValue(undefined);
    mockedRequestApiPayload.mockReset();
  });

  it("requests the default newest feed without caching it", async () => {
    await listContentPosts();

    expect(mockedRequestApiPayload).toHaveBeenCalledWith(
      "/v1/posts?sort=newest&scope=global&limit=50",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("encodes the allowlisted feed filters", async () => {
    await listContentPosts({
      category: "lost_found",
      author: "campus.user",
      cursor: "next_page-token",
      limit: 25,
    });

    expect(mockedRequestApiPayload).toHaveBeenCalledWith(
      "/v1/posts?sort=newest&scope=global&limit=25&category=lost_found&author=campus.user&cursor=next_page-token",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("requests post detail without caching it", async () => {
    await getContentPost(postId);

    expect(mockedRequestApi).toHaveBeenCalledWith(
      `/v1/posts/${postId}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("creates a post with a JSON body", async () => {
    const input = {
      category: "question" as const,
      title: "Ders notu",
      body: "Notlarını paylaşabilecek var mı?",
      isAnonymous: false,
    };

    await createContentPost(input);

    expect(mockedRequestApi).toHaveBeenCalledWith("/v1/posts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  });

  it("uploads a post image as multipart form data", async () => {
    const image = new Blob([new Uint8Array([1, 2, 3])], {
      type: "image/webp",
    });

    await uploadContentImage(image);

    const [, init] = mockedRequestApi.mock.calls[0]!;
    expect(mockedRequestApi.mock.calls[0]![0]).toBe("/v1/media");
    expect(init).toMatchObject({ method: "POST" });
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("image")).toBeInstanceOf(File);
  });

  it("updates and deletes a post at its resource path", async () => {
    const update = {
      title: "Güncel başlık",
      body: "Güncel içerik",
    };

    await updateContentPost(postId, update);
    await deleteContentPost(postId);

    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      1,
      `/v1/posts/${postId}`,
      {
        method: "PATCH",
        body: JSON.stringify(update),
      },
    );
    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      2,
      `/v1/posts/${postId}`,
      {
        method: "DELETE",
      },
    );
  });

  it("requests the popular feed when selected", async () => {
    await listContentPosts({ sort: "popular", limit: 20 });

    expect(mockedRequestApiPayload).toHaveBeenCalledWith(
      "/v1/posts?sort=popular&scope=global&limit=20",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("uses idempotent methods for likes and bookmarks", async () => {
    await setContentPostLike(postId, true);
    await setContentPostLike(postId, false);
    await setContentPostBookmark(postId, true);
    await setContentPostBookmark(postId, false);

    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      1,
      `/v1/posts/${postId}/like`,
      { method: "PUT" },
    );
    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      2,
      `/v1/posts/${postId}/like`,
      { method: "DELETE" },
    );
    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      3,
      `/v1/posts/${postId}/bookmark`,
      { method: "PUT" },
    );
    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      4,
      `/v1/posts/${postId}/bookmark`,
      { method: "DELETE" },
    );
  });

  it("creates a comment under its post and preserves the parent ID", async () => {
    const input = {
      body: "Katılıyorum.",
      isAnonymous: true,
      parentId,
    };

    await createContentComment(postId, input);

    expect(mockedRequestApi).toHaveBeenCalledWith(
      `/v1/posts/${postId}/comments`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  });

  it("updates and deletes a comment at its resource path", async () => {
    await updateContentComment(commentId, "Düzenlenmiş yorum");
    await deleteContentComment(commentId);

    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      1,
      `/v1/comments/${commentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ body: "Düzenlenmiş yorum" }),
      },
    );
    expect(mockedRequestApi).toHaveBeenNthCalledWith(
      2,
      `/v1/comments/${commentId}`,
      {
        method: "DELETE",
      },
    );
  });
});
