import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FollowSuggestionCarousel from "@/components/FollowSuggestionCarousel";
import {
  followMember,
  getSuggestedFollows,
  type SuggestedMemberDto,
} from "@/social/client";

const carouselState = vi.hoisted(() => ({
  push: vi.fn(),
  sessionMode: "member" as "guest" | "member",
  followingAuthorIds: new Set<string>(),
}));

vi.mock("@/social/client", () => ({
  getSuggestedFollows: vi.fn(),
  followMember: vi.fn(),
  unfollowMember: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: carouselState.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({ sessionMode: carouselState.sessionMode }),
}));

vi.mock("@/components/CampusFollowProvider", () => ({
  useCampusFollow: () => ({
    isHydrated: true,
    followingAuthorIds: carouselState.followingAuthorIds,
  }),
}));

vi.mock("@/components/CampusAuthorAvatar", () => ({
  default: ({ author }: { author: string }) => (
    <span data-testid="avatar">{author}</span>
  ),
}));

const mockedGetSuggestedFollows = vi.mocked(getSuggestedFollows);
const mockedFollowMember = vi.mocked(followMember);

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
 * Ortak kurulum her sorguya `false` döndürüyor; karusel yalnızca sağ rayın
 * gizlendiği dar düzende kurulduğu için kırılımı burada taklit etmek gerekiyor.
 */
function setViewportIsCompact(isCompact: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) =>
      ({
        matches: query.includes("max-width") ? isCompact : false,
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

async function renderCarousel() {
  render(<FollowSuggestionCarousel />);

  await act(async () => {});
}

describe("FollowSuggestionCarousel", () => {
  beforeEach(() => {
    carouselState.push.mockReset();
    carouselState.sessionMode = "member";
    carouselState.followingAuthorIds = new Set();
    mockedGetSuggestedFollows.mockReset().mockResolvedValue(suggestedMembers);
    mockedFollowMember.mockReset().mockResolvedValue({
      followerCount: 1,
      followingCount: 0,
      isFollowing: true,
    });
    setViewportIsCompact(true);
  });

  it("shows a scrollable card per suggestion with its reason", async () => {
    await renderCarousel();

    expect(
      await screen.findByRole("heading", { name: "Takip önerileri" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ece Arslan profilini aç" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Kaya Öztürk ve 2 kişi takip ediyor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mimarlık")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Tümünü gör/ }),
    ).toHaveAttribute("href", "/takip");
  });

  it("never mounts where the right rail already shows suggestions", async () => {
    setViewportIsCompact(false);

    const { container } = render(<FollowSuggestionCarousel />);
    await act(async () => {});

    expect(container).toBeEmptyDOMElement();
    // Masaüstünde ray zaten aynı listeyi çekiyor; ikinci istek gitmemeli.
    expect(mockedGetSuggestedFollows).not.toHaveBeenCalled();
  });

  it("stays out of the feed when there is nothing to suggest", async () => {
    mockedGetSuggestedFollows.mockResolvedValue([]);

    const { container } = render(<FollowSuggestionCarousel />);
    await act(async () => {});

    expect(container).toBeEmptyDOMElement();
  });

  it("follows optimistically from a card", async () => {
    let resolveFollow = () => {};
    mockedFollowMember.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFollow = () =>
            resolve({
              followerCount: 1,
              followingCount: 0,
              isFollowing: true,
            });
        }),
    );

    await renderCarousel();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Ece Arslan kullanıcısını takip et",
      }),
    );

    // İstek uçuştayken bile kart takip edilmiş görünür.
    expect(
      screen.getByRole("button", {
        name: "Ece Arslan kullanıcısını takipten çık",
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveFollow();
    });
  });

  it("sends a guest to login instead of calling the API", async () => {
    carouselState.sessionMode = "guest";

    await renderCarousel();

    // Misafir tohum verisinde birden çok kart var; ilki yeterli.
    const [followButton] = await screen.findAllByRole("button", {
      name: /kullanıcısını takip et$/,
    });
    fireEvent.click(followButton!);

    expect(mockedFollowMember).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Takip etmek için giriş yapmalısın.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    await waitFor(() =>
      expect(carouselState.push).toHaveBeenCalledWith("/giris"),
    );
  });
});
