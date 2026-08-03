import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FollowSuggestions, {
  FollowSuggestionsPage,
} from "@/components/FollowSuggestions";
import { campusFollowMembers } from "@/data/campusFollows";

const followSuggestionsState = vi.hoisted(() => ({
  pathname: "/akis",
  push: vi.fn(),
  showToast: vi.fn(),
  sessionMode: "guest" as "guest" | "member",
  isHydrated: true,
  followingAuthorIds: new Set<string>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => followSuggestionsState.pathname,
  useRouter: () => ({ push: followSuggestionsState.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    sessionMode: followSuggestionsState.sessionMode,
  }),
}));

vi.mock("@/components/CampusFollowProvider", () => ({
  useCampusFollow: () => ({
    isHydrated: followSuggestionsState.isHydrated,
    followingAuthorIds: followSuggestionsState.followingAuthorIds,
  }),
}));

vi.mock("@/components/FeedbackProvider", () => ({
  useFeedback: () => ({ showToast: followSuggestionsState.showToast }),
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => (
    <span data-testid="avatar">{author}</span>
  ),
}));

describe("FollowSuggestions", () => {
  beforeEach(() => {
    followSuggestionsState.pathname = "/akis";
    followSuggestionsState.sessionMode = "guest";
    followSuggestionsState.isHydrated = true;
    followSuggestionsState.followingAuthorIds = new Set();
    followSuggestionsState.push.mockReset();
    followSuggestionsState.showToast.mockReset();
  });

  it("shows four compact seed suggestions to a guest", () => {
    render(<FollowSuggestions />);

    expect(
      screen.getByRole("heading", { name: "Takip önerileri" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("avatar")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: "Tüm önerileri gör" }),
    ).toHaveAttribute("href", "/takip");
  });

  it("does not repeat the compact rail on the suggestions page", () => {
    followSuggestionsState.pathname = "/takip";

    const { container } = render(<FollowSuggestions />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the full guest discovery experience from seed data", () => {
    render(<FollowSuggestionsPage />);

    expect(
      screen.getByRole("heading", { name: "Kampüs topluluğunu keşfet" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("avatar")).toHaveLength(
      campusFollowMembers.length,
    );
    expect(screen.getByText("Kampüsten kişiler")).toBeInTheDocument();
  });

  it("offers login instead of following in guest mode", () => {
    render(<FollowSuggestionsPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `${campusFollowMembers[0].displayName} kullanıcısını takip et`,
      }),
    );

    expect(followSuggestionsState.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Takip etmek için giriş yapmalısın.",
        tone: "info",
      }),
    );

    const toast = followSuggestionsState.showToast.mock.calls[0][0];
    toast.action.onClick();
    expect(followSuggestionsState.push).toHaveBeenCalledWith("/giris");
  });
});
