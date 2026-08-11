import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FollowSuggestions, {
  FollowSuggestionsPage,
} from "@/components/FollowSuggestions";
import { campusFollowMembers } from "@/data/campusFollows";
import {
  followMember,
  getSuggestedFollows,
  unfollowMember,
  type SuggestedMemberDto,
} from "@/social/client";

const followSuggestionsState = vi.hoisted(() => ({
  pathname: "/akis",
  push: vi.fn(),
  sessionMode: "guest" as "guest" | "member",
  isHydrated: true,
  followingAuthorIds: new Set<string>(),
}));

vi.mock("@/social/client", () => ({
  getSuggestedFollows: vi.fn(),
  followMember: vi.fn(),
  unfollowMember: vi.fn(),
}));

const mockedGetSuggestedFollows = vi.mocked(getSuggestedFollows);
const mockedFollowMember = vi.mocked(followMember);
const mockedUnfollowMember = vi.mocked(unfollowMember);

const followSummary = {
  followerCount: 1,
  followingCount: 0,
  isFollowing: true,
};

const suggestedMembers: SuggestedMemberDto[] = [
  {
    id: "b4c0f0f2-1f9d-4a0a-9f2f-6f0f2b9f4a11",
    username: "ecearslan",
    displayName: "Ece Arslan",
    avatarUrl: null,
    department: "İşletme",
    bio: "Girişimcilik ve kampüs etkinlikleri.",
    followerCount: 42,
    mutualCount: 3,
    mutualNames: ["Kaya Öztürk", "Deniz Yıldız"],
    isNewMember: false,
  },
  {
    id: "0a2d9d4b-7d3c-4f1e-8a6b-2c9f1e5d7a33",
    username: "denizyildiz",
    displayName: "Deniz Yıldız",
    avatarUrl: null,
    department: "Mimarlık",
    bio: "Maket ve çizim.",
    followerCount: 4,
    mutualCount: 0,
    mutualNames: [],
    isNewMember: true,
  },
];

/**
 * Ortak kurulum `matchMedia`'yı her sorguya `false` döndürecek şekilde taklit
 * ediyor; önizleme kartı yalnızca gerçek fareyle açıldığı için bu testlerde
 * fare sorgusunu doğrulamak gerekiyor.
 */
function enableHoverPointer() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) =>
      ({
        matches: query.includes("hover: hover"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  });
}

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
    mockedGetSuggestedFollows.mockReset().mockResolvedValue(suggestedMembers);
    mockedFollowMember.mockReset().mockResolvedValue(followSummary);
    mockedUnfollowMember
      .mockReset()
      .mockResolvedValue({ ...followSummary, isFollowing: false });
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

  it("explains why a guest suggestion is shown", () => {
    render(<FollowSuggestions />);

    // Tohum veride ortak takip yok; gerekçe bölüme düşer.
    expect(screen.getByText("İşletme")).toBeInTheDocument();
  });
});

describe("FollowSuggestions rail for a member", () => {
  beforeEach(() => {
    followSuggestionsState.pathname = "/akis";
    followSuggestionsState.sessionMode = "member";
    followSuggestionsState.isHydrated = true;
    followSuggestionsState.followingAuthorIds = new Set();
    followSuggestionsState.push.mockReset();
    mockedGetSuggestedFollows.mockReset().mockResolvedValue(suggestedMembers);
    mockedFollowMember.mockReset().mockResolvedValue(followSummary);
    mockedUnfollowMember
      .mockReset()
      .mockResolvedValue({ ...followSummary, isFollowing: false });
  });

  async function renderRail() {
    render(<FollowSuggestions />);

    await screen.findByRole("link", { name: "Ece Arslan profilini aç" });
  }

  it("shows a skeleton until the suggestions arrive", async () => {
    render(<FollowSuggestions />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    await screen.findByRole("link", { name: "Ece Arslan profilini aç" });
  });

  it("names the mutual followers behind a suggestion", async () => {
    await renderRail();

    expect(
      screen.getByText("Kaya Öztürk ve 2 kişi takip ediyor"),
    ).toBeInTheDocument();
    // Ortak takipçisi olmayan yeni üye kendi gerekçesini alır.
    expect(screen.getByText("Mimarlık")).toBeInTheDocument();
  });

  it("flips the button before the follow request settles", async () => {
    let resolveFollow = () => {};
    mockedFollowMember.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFollow = () => resolve(followSummary);
        }),
    );

    await renderRail();

    fireEvent.click(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    );

    // İstek hâlâ uçuşta; durum yine de değişmiş olmalı.
    expect(
      screen.getByRole("button", {
        name: "Ece Arslan kullanıcısını takipten çık",
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveFollow();
    });

    expect(
      screen.getByRole("button", {
        name: "Ece Arslan kullanıcısını takipten çık",
      }),
    ).toBeInTheDocument();
  });

  it("rolls the button back when the follow request fails", async () => {
    mockedFollowMember.mockRejectedValue(new Error("network"));

    await renderRail();

    fireEvent.click(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Takip işlemi şu anda tamamlanamadı.",
    );
    expect(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    ).toBeInTheDocument();
  });

  it("unfollows an already followed suggestion", async () => {
    await renderRail();

    fireEvent.click(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    );

    await waitFor(() => expect(mockedFollowMember).toHaveBeenCalledOnce());

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ece Arslan kullanıcısını takipten çık",
      }),
    );

    await waitFor(() =>
      expect(mockedUnfollowMember).toHaveBeenCalledWith("ecearslan"),
    );
    expect(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    ).toBeInTheDocument();
  });

  it("keeps a followed suggestion in the list", async () => {
    await renderRail();

    fireEvent.click(
      screen.getByRole("button", { name: "Ece Arslan kullanıcısını takip et" }),
    );

    await waitFor(() => expect(mockedFollowMember).toHaveBeenCalledOnce());

    // Satır düşerse kullanıcı kimi takip ettiğini doğrulayamıyor.
    expect(
      screen.getByRole("link", { name: "Ece Arslan profilini aç" }),
    ).toBeInTheDocument();
  });

  it("re-rolls the list from the refresh control", async () => {
    await renderRail();

    fireEvent.click(screen.getByRole("button", { name: "Önerileri yenile" }));

    await waitFor(() =>
      expect(mockedGetSuggestedFollows).toHaveBeenCalledTimes(2),
    );
    expect(mockedGetSuggestedFollows).toHaveBeenLastCalledWith(4);
  });
});

describe("FollowSuggestions hover preview", () => {
  beforeEach(() => {
    followSuggestionsState.pathname = "/akis";
    followSuggestionsState.sessionMode = "member";
    followSuggestionsState.push.mockReset();
    mockedGetSuggestedFollows.mockReset().mockResolvedValue(suggestedMembers);
    enableHoverPointer();
  });

  async function findRow() {
    render(<FollowSuggestions />);

    const link = await screen.findByRole("link", {
      name: "Ece Arslan profilini aç",
    });

    // Satır göründüğü anda işaretçi tespiti henüz akmamış olabiliyor; olay
    // dinleyicileri o yeniden render'da bağlanıyor.
    await act(async () => {});

    return link.parentElement!;
  }

  it("opens after a hover dwell and closes on leave", async () => {
    const row = await findRow();

    fireEvent.pointerEnter(row, { pointerType: "mouse" });

    // Bekleme süresi dolmadan açılmamalı: imleç satırın üstünden geçerken
    // kart fırlamamalı.
    expect(screen.queryByText("42")).not.toBeInTheDocument();

    // Kart takipçi sayısı ve biyografiyle açılır.
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(
      screen.getByText("Girişimcilik ve kampüs etkinlikleri."),
    ).toBeInTheDocument();

    fireEvent.pointerLeave(row, { pointerType: "mouse" });

    await waitFor(() =>
      expect(screen.queryByText("42")).not.toBeInTheDocument(),
    );
  });

  it("opens immediately for keyboard focus", async () => {
    const row = await findRow();

    fireEvent.focus(row);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("stays closed for touch input", async () => {
    const row = await findRow();

    fireEvent.pointerEnter(row, { pointerType: "touch" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });
});
