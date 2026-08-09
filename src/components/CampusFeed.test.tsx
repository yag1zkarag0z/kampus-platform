import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampusFeed from "@/components/CampusFeed";

const campusFeedState = vi.hoisted(() => ({
  createPost: vi.fn(),
  pendingNewPostCount: 0,
  revealNewPosts: vi.fn(),
  setFeedScope: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: campusFeedState.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    accountId: "member-1",
    isGuest: false,
    profile: { username: "kampuslu" },
    sessionMode: "member",
  }),
}));

vi.mock("@/components/CampusDataProvider", () => ({
  useCampusData: () => ({
    posts: [],
    isHydrated: true,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    pendingNewPostCount: campusFeedState.pendingNewPostCount,
    revealNewPosts: campusFeedState.revealNewPosts,
    feedScope: "global",
    setFeedScope: campusFeedState.setFeedScope,
    createPost: campusFeedState.createPost,
    toggleLike: vi.fn(),
    toggleBookmark: vi.fn(),
  }),
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: () => <span data-testid="composer-avatar" />,
}));

vi.mock("@/social/client", () => ({
  getMemberFollowing: vi.fn().mockResolvedValue([]),
}));

describe("CampusFeed composer", () => {
  beforeEach(() => {
    campusFeedState.createPost.mockReset();
    campusFeedState.createPost.mockResolvedValue("post-1");
    campusFeedState.pendingNewPostCount = 0;
    campusFeedState.revealNewPosts.mockReset();
    campusFeedState.revealNewPosts.mockReturnValue(0);
    campusFeedState.setFeedScope.mockReset();
    campusFeedState.push.mockReset();
  });

  it("keeps only the newest and following feed tabs", () => {
    render(<CampusFeed />);

    expect(screen.getByRole("button", { name: "En yeni" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Takip" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "En beğenilenler" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kaydedilenler" }),
    ).not.toBeInTheDocument();
  });

  it("adds an emoji to the inline post text", () => {
    render(<CampusFeed />);

    fireEvent.click(screen.getByRole("button", { name: "Emoji ekle" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Beğeni emojisini ekle" }),
    );

    expect(screen.getByRole("textbox", { name: "Gönderi metni" })).toHaveValue(
      "👍",
    );
  });

  it("reveals staged posts from the themed feed notice", () => {
    campusFeedState.pendingNewPostCount = 3;
    campusFeedState.revealNewPosts.mockReturnValue(3);

    render(<CampusFeed />);

    fireEvent.click(
      screen.getByRole("button", { name: "3 yeni gönderiyi göster" }),
    );

    expect(campusFeedState.revealNewPosts).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("creates an inline poll with its options", async () => {
    render(<CampusFeed />);

    fireEvent.change(screen.getByRole("textbox", { name: "Gönderi metni" }), {
      target: { value: "Bugün nerede çalışalım?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anket oluştur" }));
    fireEvent.change(screen.getByLabelText("Anket seçeneği 1"), {
      target: { value: "Kütüphane" },
    });
    fireEvent.change(screen.getByLabelText("Anket seçeneği 2"), {
      target: { value: "Kafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Paylaş" }));

    await waitFor(() => {
      expect(campusFeedState.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "Bugün nerede çalışalım?",
          category: "Anket",
          isAnonymous: false,
          pollOptions: ["Kütüphane", "Kafe"],
        }),
      );
    });
  });
});
