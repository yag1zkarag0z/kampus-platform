import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CampusProfileHero from "@/components/CampusProfileHero";

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => (
    <span data-testid="profile-avatar">{author}</span>
  ),
}));

vi.mock("@/components/CampusLogo", () => ({
  default: () => <span data-testid="campus-logo">KAMPÜS.</span>,
}));

describe("CampusProfileHero avatar preview", () => {
  it("opens the profile picture and closes it with Escape", async () => {
    const user = userEvent.setup();

    render(
      <CampusProfileHero
        coverIdPrefix="profile-test"
        author="@ece"
        avatarUrl="/images/avatars/ecearslan.svg"
        displayName="Ece Arslan"
        username="ece"
        joinedLabel="Ağustos 2026'da katıldı"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Ece Arslan profil fotoğrafını aç",
    });
    await user.click(trigger);

    expect(
      screen.getByRole("dialog", {
        name: "Ece Arslan profil fotoğrafı",
      }),
    ).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
    expect(trigger).toHaveFocus();
  });

  it("closes the preview from its close button", async () => {
    const user = userEvent.setup();

    render(
      <CampusProfileHero
        coverIdPrefix="profile-test-close"
        author="@deniz"
        displayName="Deniz Akın"
        username="deniz"
        joinedLabel="Ağustos 2026'da katıldı"
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Deniz Akın profil fotoğrafını aç",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Profil fotoğrafını kapat",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
