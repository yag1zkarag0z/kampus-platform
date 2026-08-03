import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CampusMemberProfile from "@/components/CampusMemberProfile";
import { campusFollowMembers } from "@/data/campusFollows";

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    profile: {
      username: "isimsiz",
      displayName: "İsimsiz Kullanıcı",
      department: "",
      year: "",
      bio: "",
      avatarUrl: null,
      joinedLabel: "Misafir hesap",
    },
    settings: { showDepartment: false },
    sessionMode: "guest",
    isHydrated: true,
  }),
}));

vi.mock("@/components/CampusDataProvider", () => ({
  useCampusData: () => ({ posts: [], isHydrated: true }),
}));

vi.mock("@/components/CampusModerationProvider", () => ({
  useCampusModeration: () => ({
    blockedUsers: [],
    blockedAuthorIds: new Set(),
    managedUsers: [],
    isHydrated: true,
  }),
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => (
    <span data-testid="profile-avatar">{author}</span>
  ),
}));

vi.mock("@/components/CampusFollowConnections", () => ({
  default: ({ member }: { member: { username: string } }) => (
    <span data-testid="follow-connections">@{member.username}</span>
  ),
}));

describe("CampusMemberProfile seed profiles", () => {
  it.each(campusFollowMembers)(
    "renders the seed profile for @$username",
    (member) => {
      render(<CampusMemberProfile username={member.username} />);

      expect(
        screen.getByRole("heading", { name: member.displayName, level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(member.detail!).length).toBeGreaterThan(0);
      if (member.username !== "kampus") {
        expect(screen.getByText(member.bio!)).toBeInTheDocument();
      }
      expect(
        screen.getAllByText(member.joinedLabel!).length,
      ).toBeGreaterThan(0);
      expect(screen.getByTestId("follow-connections")).toHaveTextContent(
        `@${member.username}`,
      );
      expect(screen.queryByText("Profil bulunamadı")).not.toBeInTheDocument();
    },
  );

  it("keeps the not-found state for an unknown username", () => {
    render(<CampusMemberProfile username="tanimsiz-kullanici" />);

    expect(screen.getByText("Profil bulunamadı")).toBeInTheDocument();
  });
});
