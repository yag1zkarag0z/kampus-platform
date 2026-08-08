import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FollowSuggestions, {
  FollowSuggestionsPage,
} from "@/components/FollowSuggestions";
import { campusFollowMembers } from "@/data/campusFollows";

const followSuggestionsState = vi.hoisted(() => ({
  pathname: "/akis",
  push: vi.fn(),
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
  });

  it("shows four compact seed suggestions to a guest", () => {
    render(<FollowSuggestions />);

    expect(
      screen.getByRole("heading", { name: "Takip önerileri" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("avatar")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: "Tümünü gör" }),
    ).toHaveAttribute("href", "/takip");
  });

  it("does not repeat the compact rail on the suggestions page", () => {
    followSuggestionsState.pathname = "/takip";

    const { container } = render(<FollowSuggestions />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reviews guest suggestions one card at a time", () => {
    render(<FollowSuggestionsPage />);

    expect(screen.getByText("Kampüsten kişiler")).toBeInTheDocument();

    // Deste tek kart gösterir; ızgara yok.
    expect(screen.getAllByTestId("avatar")).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        name: campusFollowMembers[0].displayName,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`1 / ${campusFollowMembers.length}`),
    ).toBeInTheDocument();
  });

  it("advances to the next card when the current one is skipped", async () => {
    render(<FollowSuggestionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Geç" }));

    // Kart çıkış animasyonunu bitirdikten sonra sıradaki karta geçilir.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: campusFollowMembers[1].displayName,
        }),
      ).toBeInTheDocument(),
    );
  });

  it("shows the same follow button to a guest and routes it to login", () => {
    render(<FollowSuggestionsPage />);

    // Misafir üyeyle aynı düğmeyi görür; fark yalnızca tıklama sonucunda.
    const followButton = screen.getByRole("button", { name: "Takip et" });

    fireEvent.click(followButton);

    expect(followSuggestionsState.push).toHaveBeenCalledWith("/giris");
  });

  it("keeps the guest on the same card after being sent to login", async () => {
    render(<FollowSuggestionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Takip et" }));

    // Deste tükenmemeli: misafir giriş yapıp geri döndüğünde aynı kart durur.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: campusFollowMembers[0].displayName,
        }),
      ).toBeInTheDocument(),
    );
  });
});
