import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampusMemberSearch from "@/components/CampusMemberSearch";

const memberSearchState = vi.hoisted(() => ({
  retrySession: vi.fn(),
  searchMembers: vi.fn(),
  sessionMode: "member" as "member" | "guest" | "signed-out",
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    retrySession: memberSearchState.retrySession,
    sessionMode: memberSearchState.sessionMode,
  }),
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => <span>{author} avatarı</span>,
}));

vi.mock("@/social/client", () => ({
  searchMembers: memberSearchState.searchMembers,
}));

describe("CampusMemberSearch", () => {
  beforeEach(() => {
    memberSearchState.sessionMode = "member";
    memberSearchState.retrySession.mockReset();
    memberSearchState.searchMembers.mockReset().mockResolvedValue([]);
  });

  it("opens a compact search hint when focused", () => {
    render(<CampusMemberSearch />);

    fireEvent.focus(screen.getByRole("searchbox", { name: "Kişilerde ara" }));

    expect(screen.getByText("İsim veya kullanıcı adıyla ara.")).toBeVisible();
  });

  it("searches members after the debounce and links to their profile", async () => {
    memberSearchState.searchMembers.mockResolvedValue([
      {
        id: "member-1",
        username: "ecearslan",
        displayName: "Ece Arslan",
        avatarUrl: null,
      },
    ]);
    render(<CampusMemberSearch />);

    const input = screen.getByRole("searchbox", { name: "Kişilerde ara" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ece" } });

    await waitFor(() => {
      expect(memberSearchState.searchMembers).toHaveBeenCalledWith("Ece");
    });

    expect(await screen.findByText("Ece Arslan")).toBeVisible();
    expect(screen.getByRole("link", { name: /Ece Arslan/i })).toHaveAttribute(
      "href",
      "/profil/ecearslan",
    );
  });

  it("searches demo profiles without calling the member API for guests", async () => {
    memberSearchState.sessionMode = "guest";
    render(<CampusMemberSearch />);

    const input = screen.getByRole("searchbox", { name: "Kişilerde ara" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ece" } });

    expect(await screen.findByText("Ece Arslan")).toBeVisible();
    expect(screen.getByRole("link", { name: /Ece Arslan/i })).toHaveAttribute(
      "href",
      "/profil/ecearslan",
    );
    expect(memberSearchState.searchMembers).not.toHaveBeenCalled();
  });
});
