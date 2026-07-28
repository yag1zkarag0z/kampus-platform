"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import {
  campusFollowMembers,
  seedCampusFollowEdges,
  type CampusFollowMember,
} from "@/data/campusFollows";
import { LOCAL_ACCOUNT_OWNER_ID } from "@/data/campusPosts";

export type { CampusFollowMember } from "@/data/campusFollows";

const STORAGE_KEY = "kampus-following-v1";
const USERNAME_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;

type StoredFollowState = {
  followingAuthorIds: string[];
  dynamicMembers: CampusFollowMember[];
};

type CampusFollowContextValue = {
  isHydrated: boolean;
  followingAuthorIds: ReadonlySet<string>;
  isFollowing: (authorId: string) => boolean;
  follow: (member: CampusFollowMember) => boolean;
  unfollow: (authorId: string) => boolean;
  getFollowerCount: (authorId: string) => number;
  getFollowingCount: (authorId: string) => number;
  getFollowers: (authorId: string) => CampusFollowMember[];
  getFollowing: (authorId: string) => CampusFollowMember[];
};

const CampusFollowContext = createContext<
  CampusFollowContextValue | undefined
>(undefined);

function normalizeUsername(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase("tr-TR");
}

function normalizeMember(value: unknown): CampusFollowMember | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const member = value as Partial<CampusFollowMember>;
  const authorId = member.authorId?.trim();
  const username = normalizeUsername(member.username ?? "");
  const author = member.author?.trim();
  const displayName = member.displayName?.trim();

  if (
    !authorId ||
    !author ||
    !displayName ||
    !USERNAME_PATTERN.test(username)
  ) {
    return null;
  }

  return {
    authorId,
    username,
    author,
    displayName,
    detail: member.detail?.trim() || undefined,
    avatarDataUrl: member.avatarDataUrl,
  };
}

function getDefaultFollowingIds() {
  return new Set(seedCampusFollowEdges[LOCAL_ACCOUNT_OWNER_ID] ?? []);
}

function readStoredState(): StoredFollowState {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return {
        followingAuthorIds: Array.from(getDefaultFollowingIds()),
        dynamicMembers: [],
      };
    }

    const parsed = JSON.parse(storedValue) as Partial<StoredFollowState>;
    const followingAuthorIds = Array.isArray(parsed.followingAuthorIds)
      ? parsed.followingAuthorIds.filter(
          (authorId): authorId is string =>
            typeof authorId === "string" &&
            authorId.length > 0 &&
            authorId !== LOCAL_ACCOUNT_OWNER_ID,
        )
      : Array.from(getDefaultFollowingIds());
    const dynamicMembers = Array.isArray(parsed.dynamicMembers)
      ? parsed.dynamicMembers
          .map(normalizeMember)
          .filter(
            (member): member is CampusFollowMember => member !== null,
          )
      : [];

    return {
      followingAuthorIds: Array.from(new Set(followingAuthorIds)),
      dynamicMembers,
    };
  } catch {
    return {
      followingAuthorIds: Array.from(getDefaultFollowingIds()),
      dynamicMembers: [],
    };
  }
}

export function CampusFollowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    profile,
    sessionMode,
    isHydrated: isAccountHydrated,
  } = useCampusAccount();
  const { blockedAuthorIds, isHydrated: isModerationHydrated } =
    useCampusModeration();
  const [followingAuthorIds, setFollowingAuthorIds] = useState(
    getDefaultFollowingIds,
  );
  const followingRef = useRef(followingAuthorIds);
  const [dynamicMembers, setDynamicMembers] = useState<
    CampusFollowMember[]
  >([]);
  const dynamicMembersRef = useRef(dynamicMembers);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  const currentMember = useMemo<CampusFollowMember>(
    () => ({
      authorId: LOCAL_ACCOUNT_OWNER_ID,
      author: `@${profile.username}`,
      displayName: profile.displayName,
      username: normalizeUsername(profile.username),
      detail: [profile.department, profile.year]
        .filter(Boolean)
        .join(" · "),
      avatarDataUrl: profile.avatarDataUrl,
    }),
    [profile],
  );

  const memberDirectory = useMemo(() => {
    const directory = new Map<string, CampusFollowMember>();

    campusFollowMembers.forEach((member) =>
      directory.set(member.authorId, member),
    );
    dynamicMembers.forEach((member) =>
      directory.set(member.authorId, member),
    );
    directory.set(LOCAL_ACCOUNT_OWNER_ID, currentMember);

    return directory;
  }, [currentMember, dynamicMembers]);

  const updateFollowing = useCallback(
    (nextFollowing: Set<string>) => {
      followingRef.current = nextFollowing;
      setFollowingAuthorIds(nextFollowing);
    },
    [],
  );

  const updateDynamicMembers = useCallback(
    (nextMembers: CampusFollowMember[]) => {
      dynamicMembersRef.current = nextMembers;
      setDynamicMembers(nextMembers);
    },
    [],
  );

  useEffect(() => {
    if (!isAccountHydrated || !isModerationHydrated) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      const storedState = readStoredState();
      updateFollowing(new Set(storedState.followingAuthorIds));
      updateDynamicMembers(storedState.dynamicMembers);
      setIsStorageHydrated(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [
    isAccountHydrated,
    isModerationHydrated,
    updateDynamicMembers,
    updateFollowing,
  ]);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const storedState = readStoredState();
      updateFollowing(new Set(storedState.followingAuthorIds));
      updateDynamicMembers(storedState.dynamicMembers);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isStorageHydrated, updateDynamicMembers, updateFollowing]);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          followingAuthorIds: Array.from(followingAuthorIds),
          dynamicMembers,
        } satisfies StoredFollowState),
      );
    } catch {
      // The current tab remains usable if browser storage is unavailable.
    }
  }, [dynamicMembers, followingAuthorIds, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    const nextFollowing = new Set(
      Array.from(followingRef.current).filter(
        (authorId) => !blockedAuthorIds.has(authorId),
      ),
    );

    if (nextFollowing.size === followingRef.current.size) {
      return;
    }

    queueMicrotask(() => updateFollowing(nextFollowing));
  }, [blockedAuthorIds, isStorageHydrated, updateFollowing]);

  const isFollowing = useCallback(
    (authorId: string) => followingAuthorIds.has(authorId),
    [followingAuthorIds],
  );

  const follow = useCallback(
    (memberValue: CampusFollowMember) => {
      const member = normalizeMember(memberValue);

      if (
        sessionMode !== "member" ||
        !member ||
        member.authorId === LOCAL_ACCOUNT_OWNER_ID ||
        blockedAuthorIds.has(member.authorId) ||
        followingRef.current.has(member.authorId)
      ) {
        return false;
      }

      if (!memberDirectory.has(member.authorId)) {
        const nextMembers = [
          ...dynamicMembersRef.current.filter(
            (item) => item.authorId !== member.authorId,
          ),
          member,
        ];
        updateDynamicMembers(nextMembers);
      }

      const nextFollowing = new Set(followingRef.current);
      nextFollowing.add(member.authorId);
      updateFollowing(nextFollowing);
      return true;
    },
    [
      blockedAuthorIds,
      memberDirectory,
      sessionMode,
      updateDynamicMembers,
      updateFollowing,
    ],
  );

  const unfollow = useCallback(
    (authorId: string) => {
      if (
        sessionMode !== "member" ||
        !followingRef.current.has(authorId)
      ) {
        return false;
      }

      const nextFollowing = new Set(followingRef.current);
      nextFollowing.delete(authorId);
      updateFollowing(nextFollowing);
      return true;
    },
    [sessionMode, updateFollowing],
  );

  const getFollowingIds = useCallback(
    (authorId: string) =>
      authorId === LOCAL_ACCOUNT_OWNER_ID
        ? followingAuthorIds
        : new Set(seedCampusFollowEdges[authorId] ?? []),
    [followingAuthorIds],
  );

  const getFollowing = useCallback(
    (authorId: string) =>
      Array.from(getFollowingIds(authorId))
        .filter((targetId) => !blockedAuthorIds.has(targetId))
        .map((targetId) => memberDirectory.get(targetId))
        .filter(
          (member): member is CampusFollowMember => member !== undefined,
        ),
    [blockedAuthorIds, getFollowingIds, memberDirectory],
  );

  const getFollowers = useCallback(
    (authorId: string) =>
      Array.from(memberDirectory.values()).filter((member) => {
        if (
          member.authorId === authorId ||
          blockedAuthorIds.has(member.authorId)
        ) {
          return false;
        }

        return getFollowingIds(member.authorId).has(authorId);
      }),
    [blockedAuthorIds, getFollowingIds, memberDirectory],
  );

  const getFollowerCount = useCallback(
    (authorId: string) => getFollowers(authorId).length,
    [getFollowers],
  );
  const getFollowingCount = useCallback(
    (authorId: string) => getFollowing(authorId).length,
    [getFollowing],
  );

  const value = useMemo<CampusFollowContextValue>(
    () => ({
      isHydrated:
        isAccountHydrated &&
        isModerationHydrated &&
        isStorageHydrated,
      followingAuthorIds,
      isFollowing,
      follow,
      unfollow,
      getFollowerCount,
      getFollowingCount,
      getFollowers,
      getFollowing,
    }),
    [
      follow,
      followingAuthorIds,
      getFollowerCount,
      getFollowers,
      getFollowing,
      getFollowingCount,
      isAccountHydrated,
      isFollowing,
      isModerationHydrated,
      isStorageHydrated,
      unfollow,
    ],
  );

  return (
    <CampusFollowContext.Provider value={value}>
      {children}
    </CampusFollowContext.Provider>
  );
}

export function useCampusFollow() {
  const context = useContext(CampusFollowContext);

  if (!context) {
    throw new Error(
      "useCampusFollow must be used inside CampusFollowProvider.",
    );
  }

  return context;
}
