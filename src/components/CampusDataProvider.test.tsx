import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CampusDataProvider,
  useCampusData,
} from "@/components/CampusDataProvider";
import { guestCampusPosts } from "@/data/campusPosts";

const dataState = vi.hoisted(() => ({
  blockedAuthorIds: new Set<string>(),
  managedUsers: [] as Array<{
    authorId: string;
    status: "active" | "suspended";
  }>,
  account: {
    profile: {
      username: "yagizkaragoz",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
    },
    settings: {
      showDepartment: true,
    },
    isGuest: false,
    sessionMode: "member" as "member" | "guest" | "signed-out",
    role: "member" as "member" | "moderator" | "admin",
  },
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => dataState.account,
}));

vi.mock("@/components/CampusModerationProvider", () => ({
  useCampusModeration: () => ({
    blockedAuthorIds: dataState.blockedAuthorIds,
    managedUsers: dataState.managedUsers,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CampusDataProvider>{children}</CampusDataProvider>
);

describe("CampusDataProvider", () => {
  beforeEach(() => {
    dataState.blockedAuthorIds.clear();
    dataState.managedUsers.length = 0;
    Object.assign(dataState.account, {
      isGuest: false,
      sessionMode: "member",
      role: "member",
    });
  });

  it("creates, edits and soft-deletes an owned post", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    let postId = "";
    act(() => {
      postId = result.current.createPost({
        title: "  Yeni başlık ",
        body: "  Yeni içerik ",
        category: "Soru",
        isAnonymous: false,
      });
    });

    expect(result.current.posts.find((post) => post.id === postId)).toMatchObject({
      title: "Yeni başlık",
      body: "Yeni içerik",
      category: "Soru",
    });

    act(() => {
      expect(
        result.current.updatePost(postId, {
          title: "Düzenlenmiş",
          body: "Yeni gövde",
        }),
      ).toBe(true);
    });
    expect(result.current.posts.find((post) => post.id === postId)).toMatchObject({
      title: "Düzenlenmiş",
      body: "Yeni gövde",
      edited: true,
    });

    act(() => {
      expect(result.current.deletePost(postId)).toBe(true);
    });
    expect(result.current.posts.find((post) => post.id === postId)).toMatchObject({
      title: "",
      body: "",
      isDeleted: true,
    });
  });

  it("rejects empty content and malformed polls", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(() =>
      result.current.createPost({
        body: "   ",
        category: "Sohbet",
        isAnonymous: false,
      }),
    ).toThrow("Post content is invalid.");

    expect(() =>
      result.current.createPost({
        body: "Anket",
        category: "Anket",
        isAnonymous: false,
        pollOptions: ["Aynı", "aynı"],
      }),
    ).toThrow("Poll options are invalid.");
  });

  it("toggles likes and bookmarks", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    const initialPost = result.current.posts.find((post) => !post.isDeleted);
    expect(initialPost).toBeDefined();

    const initialLikes = initialPost?.likes ?? 0;
    const initialLiked = initialPost?.liked ?? false;
    const initialBookmarked = initialPost?.bookmarked ?? false;

    act(() => {
      result.current.toggleLike(initialPost!.id);
      result.current.toggleBookmark(initialPost!.id);
    });

    const updatedPost = result.current.posts.find(
      (post) => post.id === initialPost!.id,
    );
    expect(updatedPost?.liked).toBe(!initialLiked);
    expect(updatedPost?.likes).toBe(
      initialLiked ? Math.max(0, initialLikes - 1) : initialLikes + 1,
    );
    expect(updatedPost?.bookmarked).toBe(!initialBookmarked);
  });

  it("adds a comment to an active post", async () => {
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    const post = result.current.posts.find((item) => !item.isDeleted);
    expect(post).toBeDefined();
    const initialCommentCount = post?.comments.length ?? 0;

    act(() => {
      result.current.addComment(post!.id, {
        body: " Yeni yorum ",
        isAnonymous: false,
      });
    });

    const updatedPost = result.current.posts.find(
      (item) => item.id === post!.id,
    );
    expect(updatedPost?.comments).toHaveLength(initialCommentCount + 1);
    expect(updatedPost?.comments.at(-1)?.body).toBe("Yeni yorum");
  });

  it("keeps guest data read-only and limited to the guest feed", async () => {
    Object.assign(dataState.account, {
      isGuest: true,
      sessionMode: "guest",
    });
    const { result } = renderHook(() => useCampusData(), { wrapper });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.posts).toHaveLength(guestCampusPosts.length);
    expect(() =>
      result.current.createPost({
        body: "Yazılamaz",
        category: "Sohbet",
        isAnonymous: false,
      }),
    ).toThrow("This session is read-only.");

    const firstPost = result.current.posts[0];
    act(() => result.current.toggleLike(firstPost.id));
    expect(result.current.posts[0].liked).toBe(firstPost.liked);
  });
});
