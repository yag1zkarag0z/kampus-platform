import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampusExplore from "@/components/CampusExplore";

const exploreState = vi.hoisted(() => ({
  push: vi.fn(),
  registerPosts: vi.fn(),
  searchMembers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: exploreState.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    isGuest: true,
    retrySession: vi.fn(),
    sessionMode: "guest",
  }),
}));

vi.mock("@/components/CampusDataProvider", () => ({
  useCampusData: () => ({
    posts: [],
    registerPosts: exploreState.registerPosts,
    toggleBookmark: vi.fn(),
    toggleLike: vi.fn(),
  }),
}));

vi.mock("@/components/useCampusPostQuery", () => ({
  useDebouncedValue: <T,>(value: T) => value,
  useCampusPostQuery: () => ({
    posts: [],
    isLoading: false,
    hasFailed: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("@/components/CampusTrendingTopics", () => ({
  default: () => null,
}));

vi.mock("@/components/CampusCategoryNav", () => ({
  default: () => null,
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => <span>{author} avatarı</span>,
}));

vi.mock("@/social/client", () => ({
  searchMembers: exploreState.searchMembers,
}));

describe("CampusExplore profile search", () => {
  beforeEach(() => {
    exploreState.push.mockReset();
    exploreState.registerPosts.mockReset();
    exploreState.searchMembers.mockReset();
  });

  it("shows matching guest profiles below the main explore search", async () => {
    render(<CampusExplore />);

    const input = screen.getByRole("searchbox", {
      name: "Kampüs gönderilerinde ara",
    });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ece" } });

    expect(await screen.findByText("Ece Arslan")).toBeVisible();
    expect(screen.getByRole("link", { name: /Ece Arslan/i })).toHaveAttribute(
      "href",
      "/profil/ecearslan",
    );
    expect(exploreState.searchMembers).not.toHaveBeenCalled();
  });

  it("commits post search with the unrestricted newest view", () => {
    render(<CampusExplore />);

    const input = screen.getByRole("searchbox", {
      name: "Kampüs gönderilerinde ara",
    });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ece" } });
    fireEvent.click(
      screen.getByRole("button", { name: "“Ece” gönderilerinde ara" }),
    );

    expect(screen.getByRole("button", { name: "Yeni" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Yükselen" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
