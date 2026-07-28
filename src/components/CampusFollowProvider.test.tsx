import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CampusFollowProvider,
  useCampusFollow,
  type CampusFollowMember,
} from "@/components/CampusFollowProvider";
import { LOCAL_ACCOUNT_OWNER_ID } from "@/data/campusPosts";

const followState = vi.hoisted(() => ({
  blockedAuthorIds: new Set<string>(),
  account: {
    profile: {
      username: "yagizkaragoz",
      displayName: "Yağız Karagöz",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
    },
    sessionMode: "member" as "member" | "guest" | "signed-out",
    isHydrated: true,
  },
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => followState.account,
}));

vi.mock("@/components/CampusModerationProvider", () => ({
  useCampusModeration: () => ({
    blockedAuthorIds: followState.blockedAuthorIds,
    isHydrated: true,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CampusFollowProvider>{children}</CampusFollowProvider>
);

const newMember: CampusFollowMember = {
  authorId: "test-member",
  author: "@testmember",
  displayName: "Test Member",
  username: "testmember",
  detail: "Mühendislik",
};

describe("CampusFollowProvider", () => {
  beforeEach(() => {
    followState.blockedAuthorIds.clear();
    followState.account.sessionMode = "member";
  });

  it("follows and unfollows a valid member", async () => {
    const { result } = renderHook(() => useCampusFollow(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      expect(result.current.follow(newMember)).toBe(true);
    });
    expect(result.current.isFollowing(newMember.authorId)).toBe(true);

    act(() => {
      expect(result.current.unfollow(newMember.authorId)).toBe(true);
    });
    expect(result.current.isFollowing(newMember.authorId)).toBe(false);
  });

  it("rejects duplicate, self and blocked follow requests", async () => {
    followState.blockedAuthorIds.add("blocked-member");
    const { result } = renderHook(() => useCampusFollow(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      expect(result.current.follow(newMember)).toBe(true);
    });
    expect(result.current.follow(newMember)).toBe(false);
    expect(
      result.current.follow({
        ...newMember,
        authorId: LOCAL_ACCOUNT_OWNER_ID,
      }),
    ).toBe(false);
    expect(
      result.current.follow({
        ...newMember,
        authorId: "blocked-member",
      }),
    ).toBe(false);
  });

  it("keeps guest sessions read-only", async () => {
    followState.account.sessionMode = "guest";
    const { result } = renderHook(() => useCampusFollow(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.follow(newMember)).toBe(false);
    expect(result.current.unfollow("seed-ecearslan")).toBe(false);
  });

  it("exposes follower and following counts", async () => {
    const { result } = renderHook(() => useCampusFollow(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(
      result.current.getFollowingCount(LOCAL_ACCOUNT_OWNER_ID),
    ).toBeGreaterThan(0);
    expect(
      result.current.getFollowerCount(LOCAL_ACCOUNT_OWNER_ID),
    ).toBeGreaterThan(0);
  });
});
