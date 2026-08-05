"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { AuthClientError } from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusButton } from "@/components/campusButtonStyles";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import {
  type CampusFollowMember,
  useCampusFollow,
} from "@/components/CampusFollowProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { LOCAL_ACCOUNT_OWNER_ID } from "@/data/campusPosts";
import {
  followMember,
  getMemberFollowers,
  getMemberFollowing,
  getMemberProfile,
  unfollowMember,
  type FollowMemberDto,
} from "@/social/client";

type FollowList = "followers" | "following";

type FollowListMember = {
  authorId: string;
  author: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

type CampusFollowConnectionsProps = {
  member: CampusFollowMember;
  isSelf?: boolean;
  isBlocked?: boolean;
  isSuspended?: boolean;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

function getProfileHref(
  member: FollowListMember,
  sessionMode: "signed-out" | "guest" | "member",
) {
  if (
    member.authorId === LOCAL_ACCOUNT_OWNER_ID &&
    sessionMode === "member"
  ) {
    return "/profil";
  }

  return `/profil/${encodeURIComponent(member.username)}`;
}

function toFollowListMembers(
  members: CampusFollowMember[],
): FollowListMember[] {
  return members.map((item) => ({
    authorId: item.authorId,
    author: item.author,
    username: item.username,
    displayName: item.displayName,
  }));
}

function toFollowListMember(dto: FollowMemberDto): FollowListMember {
  return {
    authorId: dto.id,
    author: `@${dto.username}`,
    username: dto.username,
    displayName: dto.displayName,
    avatarUrl: dto.avatarUrl,
  };
}

export default function CampusFollowConnections(
  props: CampusFollowConnectionsProps,
) {
  const { sessionMode } = useCampusAccount();

  if (sessionMode === "member") {
    return <MemberFollowConnections {...props} />;
  }

  return <GuestFollowConnections {...props} />;
}

function GuestFollowConnections({
  member,
  isSelf = false,
  isBlocked = false,
  isSuspended = false,
}: CampusFollowConnectionsProps) {
  const router = useRouter();
  const { sessionMode } = useCampusAccount();
  const { showToast } = useFeedback();
  const {
    isHydrated,
    isFollowing,
    follow,
    unfollow,
    getFollowerCount,
    getFollowingCount,
    getFollowers,
    getFollowing,
  } = useCampusFollow();

  const followed =
    sessionMode === "member" && isFollowing(member.authorId);

  const handleFollowToggle = () => {
    if (sessionMode !== "member") {
      showToast({
        message: "Takip etmek için giriş yapmalısın.",
        tone: "info",
        action: {
          label: "Giriş yap",
          onClick: () => router.push("/giris"),
        },
      });
      return;
    }

    const changed = followed
      ? unfollow(member.authorId)
      : follow(member);

    if (!changed) {
      showToast({
        message: "Takip işlemi şu anda tamamlanamadı.",
        tone: "error",
      });
      return;
    }
    // Buton durumu değiştiği için ayrıca toast göstermiyoruz.
  };

  return (
    <FollowConnectionsView
      member={member}
      isSelf={isSelf}
      isBlocked={isBlocked}
      isSuspended={isSuspended}
      isHydrated={isHydrated}
      followed={followed}
      followerCount={getFollowerCount(member.authorId)}
      followingCount={getFollowingCount(member.authorId)}
      followers={toFollowListMembers(getFollowers(member.authorId))}
      following={toFollowListMembers(getFollowing(member.authorId))}
      onFollowToggle={handleFollowToggle}
    />
  );
}

function useMemberFollowState(username: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState<FollowListMember[]>([]);
  const [following, setFollowing] = useState<FollowListMember[]>([]);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followersCursor, setFollowersCursor] = useState<string | null>(null);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const hasFetchedFollowersRef = useRef(false);
  const hasFetchedFollowingRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;
    hasFetchedFollowersRef.current = false;
    hasFetchedFollowingRef.current = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      setIsLoading(true);
      setFollowers([]);
      setFollowing([]);
    });

    getMemberProfile(username)
      .then((profile) => {
        if (isCancelled) {
          return;
        }

        setFollowerCount(profile.followerCount);
        setFollowingCount(profile.followingCount);
        setIsFollowing(profile.isFollowing);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [username]);

  const loadFollowers = useCallback(() => {
    if (hasFetchedFollowersRef.current) {
      return;
    }

    hasFetchedFollowersRef.current = true;
    setIsFollowersLoading(true);

    getMemberFollowers(username)
      .then((result) => {
        setFollowers(result.data.map(toFollowListMember));
        setFollowersCursor(
          result.page.hasMore ? result.page.nextCursor : null,
        );
      })
      .catch(() => {
        hasFetchedFollowersRef.current = false;
      })
      .finally(() => setIsFollowersLoading(false));
  }, [username]);

  const loadFollowing = useCallback(() => {
    if (hasFetchedFollowingRef.current) {
      return;
    }

    hasFetchedFollowingRef.current = true;
    setIsFollowingLoading(true);

    getMemberFollowing(username)
      .then((result) => {
        setFollowing(result.data.map(toFollowListMember));
        setFollowingCursor(
          result.page.hasMore ? result.page.nextCursor : null,
        );
      })
      .catch(() => {
        hasFetchedFollowingRef.current = false;
      })
      .finally(() => setIsFollowingLoading(false));
  }, [username]);

  const loadMoreFollowers = useCallback(async () => {
    if (!followersCursor) {
      return;
    }

    const result = await getMemberFollowers(username, followersCursor);

    setFollowers((current) => [
      ...current,
      ...result.data.map(toFollowListMember),
    ]);
    setFollowersCursor(result.page.hasMore ? result.page.nextCursor : null);
  }, [followersCursor, username]);

  const loadMoreFollowing = useCallback(async () => {
    if (!followingCursor) {
      return;
    }

    const result = await getMemberFollowing(username, followingCursor);

    setFollowing((current) => [
      ...current,
      ...result.data.map(toFollowListMember),
    ]);
    setFollowingCursor(result.page.hasMore ? result.page.nextCursor : null);
  }, [followingCursor, username]);

  const follow = useCallback(async () => {
    const summary = await followMember(username);
    setFollowerCount(summary.followerCount);
    setFollowingCount(summary.followingCount);
    setIsFollowing(summary.isFollowing);
    hasFetchedFollowersRef.current = false;
  }, [username]);

  const unfollow = useCallback(async () => {
    const summary = await unfollowMember(username);
    setFollowerCount(summary.followerCount);
    setFollowingCount(summary.followingCount);
    setIsFollowing(summary.isFollowing);
    hasFetchedFollowersRef.current = false;
  }, [username]);

  return {
    isLoading,
    followerCount,
    followingCount,
    isFollowing,
    followers,
    following,
    isFollowersLoading,
    isFollowingLoading,
    loadFollowers,
    loadFollowing,
    hasMoreFollowers: followersCursor !== null,
    hasMoreFollowing: followingCursor !== null,
    loadMoreFollowers,
    loadMoreFollowing,
    follow,
    unfollow,
  };
}

function MemberFollowConnections({
  member,
  isSelf = false,
  isBlocked = false,
  isSuspended = false,
}: CampusFollowConnectionsProps) {
  const { showToast } = useFeedback();
  const state = useMemberFollowState(member.username);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFollowToggle = async () => {
    if (isSubmitting) {
      return;
    }

    const wasFollowing = state.isFollowing;
    setIsSubmitting(true);

    try {
      if (wasFollowing) {
        await state.unfollow();
      } else {
        await state.follow();
      }
      // Buton durumu değiştiği için ayrıca toast göstermiyoruz.
    } catch (error) {
      showToast({
        message:
          error instanceof AuthClientError
            ? error.message
            : "Takip işlemi şu anda tamamlanamadı.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FollowConnectionsView
      member={member}
      isSelf={isSelf}
      isBlocked={isBlocked}
      isSuspended={isSuspended}
      isHydrated={!state.isLoading}
      isSubmitting={isSubmitting}
      followed={state.isFollowing}
      followerCount={state.followerCount}
      followingCount={state.followingCount}
      followers={state.followers}
      following={state.following}
      isFollowersLoading={state.isFollowersLoading}
      isFollowingLoading={state.isFollowingLoading}
      onOpenFollowers={state.loadFollowers}
      onOpenFollowing={state.loadFollowing}
      hasMoreFollowers={state.hasMoreFollowers}
      hasMoreFollowing={state.hasMoreFollowing}
      onLoadMoreFollowers={state.loadMoreFollowers}
      onLoadMoreFollowing={state.loadMoreFollowing}
      onFollowToggle={() => void handleFollowToggle()}
    />
  );
}

function FollowConnectionsView({
  member,
  isSelf,
  isBlocked,
  isSuspended,
  isHydrated,
  isSubmitting = false,
  followed,
  followerCount,
  followingCount,
  followers,
  following,
  isFollowersLoading = false,
  isFollowingLoading = false,
  onOpenFollowers,
  onOpenFollowing,
  hasMoreFollowers = false,
  hasMoreFollowing = false,
  onLoadMoreFollowers,
  onLoadMoreFollowing,
  onFollowToggle,
}: {
  member: FollowListMember;
  isSelf: boolean;
  isBlocked: boolean;
  isSuspended: boolean;
  isHydrated: boolean;
  isSubmitting?: boolean;
  followed: boolean;
  followerCount: number;
  followingCount: number;
  followers: FollowListMember[];
  following: FollowListMember[];
  isFollowersLoading?: boolean;
  isFollowingLoading?: boolean;
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  hasMoreFollowers?: boolean;
  hasMoreFollowing?: boolean;
  onLoadMoreFollowers?: () => Promise<void>;
  onLoadMoreFollowing?: () => Promise<void>;
  onFollowToggle: () => void;
}) {
  const { sessionMode } = useCampusAccount();
  const [activeList, setActiveList] = useState<FollowList | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const listTriggerRef = useRef<HTMLButtonElement | null>(null);

  const visibleMembers =
    activeList === "followers"
      ? followers
      : activeList === "following"
        ? following
        : [];
  const isListLoading =
    activeList === "followers"
      ? isFollowersLoading
      : activeList === "following"
        ? isFollowingLoading
        : false;
  const hasMoreInList =
    activeList === "followers"
      ? hasMoreFollowers
      : activeList === "following"
        ? hasMoreFollowing
        : false;
  const loadMoreInList =
    activeList === "followers" ? onLoadMoreFollowers : onLoadMoreFollowing;

  useEffect(() => {
    if (!activeList) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveList(null);
      }
    };

    document.addEventListener("keydown", closeWithEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeWithEscape);
      window.requestAnimationFrame(() => listTriggerRef.current?.focus());
    };
  }, [activeList]);

  const openList = (
    list: FollowList,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    listTriggerRef.current = event.currentTarget;
    setActiveList(list);

    if (list === "followers") {
      onOpenFollowers?.();
    } else {
      onOpenFollowing?.();
    }
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!isSelf && (
          <button
            type="button"
            disabled={!isHydrated || isSubmitting || isBlocked || isSuspended}
            aria-pressed={followed}
            onClick={onFollowToggle}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center px-5 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
              followed
                ? "border border-white/12 bg-transparent text-white hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8"
                : "bg-white text-[#12100e] hover:bg-white/90"
            }`}
          >
            {followed ? "Takip ediliyor" : "Takip et"}
          </button>
        )}

        <button
          type="button"
          disabled={!isHydrated}
          onClick={(event) => openList("followers", event)}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-xs text-white/62 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
        >
          <strong className="text-sm font-black text-white">
            {isHydrated ? followerCount : "—"}
          </strong>
          takipçi
        </button>

        <button
          type="button"
          disabled={!isHydrated}
          onClick={(event) => openList("following", event)}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-xs text-white/62 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
        >
          <strong className="text-sm font-black text-white">
            {isHydrated ? followingCount : "—"}
          </strong>
          takip
        </button>
      </div>

      {activeList && (
        <div
          role="presentation"
          className="fixed inset-0 z-[110] grid items-end bg-[#0a0d16]/70 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveList(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-list-title"
            className="max-h-[min(78svh,42rem)] w-full overflow-hidden border border-white/12 bg-[#141720] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-w-md"
          >
            <header className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#ff7a45]">
                  @{member.username}
                </p>
                <h2
                  id="follow-list-title"
                  className="mt-0.5 text-lg font-black tracking-[-0.035em]"
                >
                  {activeList === "followers"
                    ? "Takipçiler"
                    : "Takip edilenler"}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Listeyi kapat"
                onClick={() => setActiveList(null)}
                className={`grid size-11 cursor-pointer place-items-center rounded-full text-xl text-white/62 hover:bg-white/8 hover:text-white ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="max-h-[calc(min(78svh,42rem)-4rem)] overflow-y-auto">
              {isListLoading ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-black">Yükleniyor…</p>
                </div>
              ) : visibleMembers.length > 0 ? (
                <ul className="divide-y divide-white/10">
                  {visibleMembers.map((visibleMember) => (
                    <li key={visibleMember.authorId}>
                      <Link
                        href={getProfileHref(
                          visibleMember,
                          sessionMode,
                        )}
                        onClick={() => setActiveList(null)}
                        className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${focusRing}`}
                      >
                        <CampusAuthorAvatar
                          author={visibleMember.author}
                          authorId={visibleMember.authorId}
                          avatarUrl={visibleMember.avatarUrl}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">
                            {visibleMember.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-white/62">
                            @{visibleMember.username}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!isListLoading && visibleMembers.length > 0 && hasMoreInList && (
                <div className="px-4 py-4 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      void loadMoreInList?.().catch(() => undefined)
                    }
                    className={`${campusButton.secondary} `}
                  >
                    Daha fazla göster
                  </button>
                </div>
              )}

              {!isListLoading && visibleMembers.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-black">
                    {activeList === "followers"
                      ? "Henüz takipçi yok"
                      : "Henüz kimse takip edilmiyor"}
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/62">
                    Topluluktaki yeni bağlantılar burada görünecek.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
