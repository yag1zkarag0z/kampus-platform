"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import {
  type CampusFollowMember,
  useCampusFollow,
} from "@/components/CampusFollowProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { LOCAL_ACCOUNT_OWNER_ID } from "@/data/campusPosts";

type FollowList = "followers" | "following";

type CampusFollowConnectionsProps = {
  member: CampusFollowMember;
  isSelf?: boolean;
  isBlocked?: boolean;
  isSuspended?: boolean;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf8f1] dark:focus-visible:ring-[#c7896d]/30 dark:focus-visible:ring-offset-[#17191c]";

function getProfileHref(
  member: CampusFollowMember,
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

export default function CampusFollowConnections({
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
  const [activeList, setActiveList] = useState<FollowList | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const listTriggerRef = useRef<HTMLButtonElement | null>(null);

  const followed =
    sessionMode === "member" && isFollowing(member.authorId);
  const followerCount = getFollowerCount(member.authorId);
  const followingCount = getFollowingCount(member.authorId);
  const visibleMembers =
    activeList === "followers"
      ? getFollowers(member.authorId)
      : activeList === "following"
        ? getFollowing(member.authorId)
        : [];

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
  };

  const handleFollow = () => {
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

    showToast({
      message: followed
        ? `${member.displayName} artık takip edilmiyor.`
        : `${member.displayName} takip edilmeye başlandı.`,
      tone: "success",
    });
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!isSelf && (
          <button
            type="button"
            disabled={!isHydrated || isBlocked || isSuspended}
            aria-pressed={followed}
            onClick={handleFollow}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center px-5 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
              followed
                ? "border border-[#1c2821]/16 bg-transparent text-[#1c2821] hover:bg-[#1c2821]/6 dark:border-white/14 dark:text-[#ece8e1] dark:hover:bg-white/7"
                : "bg-[#5a1f32] text-white hover:bg-[#6b2940] dark:bg-[#c7896d] dark:text-[#17191c] dark:hover:bg-[#d79a7b]"
            }`}
          >
            {followed ? "Takip ediliyor" : "Takip et"}
          </button>
        )}

        <button
          type="button"
          disabled={!isHydrated}
          onClick={(event) => openList("followers", event)}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-xs text-[#58635c] transition-colors hover:text-[#1c2821] disabled:cursor-wait disabled:opacity-50 dark:text-[#aeb4af] dark:hover:text-white ${focusRing}`}
        >
          <strong className="text-sm font-black text-[#1c2821] dark:text-[#ece8e1]">
            {isHydrated ? followerCount : "—"}
          </strong>
          takipçi
        </button>

        <button
          type="button"
          disabled={!isHydrated}
          onClick={(event) => openList("following", event)}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-xs text-[#58635c] transition-colors hover:text-[#1c2821] disabled:cursor-wait disabled:opacity-50 dark:text-[#aeb4af] dark:hover:text-white ${focusRing}`}
        >
          <strong className="text-sm font-black text-[#1c2821] dark:text-[#ece8e1]">
            {isHydrated ? followingCount : "—"}
          </strong>
          takip
        </button>
      </div>

      {activeList && (
        <div
          role="presentation"
          className="fixed inset-0 z-[110] grid items-end bg-[#111315]/55 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5"
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
            className="max-h-[min(78svh,42rem)] w-full overflow-hidden border border-[#1c2821]/14 bg-[#fbf8f1] text-[#1c2821] shadow-[0_24px_80px_rgba(17,19,21,0.28)] dark:border-white/12 dark:bg-[#202226] dark:text-[#ece8e1] sm:max-w-md"
          >
            <header className="flex min-h-16 items-center justify-between border-b border-[#1c2821]/11 px-4 dark:border-white/9">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#7d3c2d] dark:text-[#d09272]">
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
                className={`grid size-11 cursor-pointer place-items-center rounded-full text-xl text-[#58635c] hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/7 dark:hover:text-white ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="max-h-[calc(min(78svh,42rem)-4rem)] overflow-y-auto">
              {visibleMembers.length > 0 ? (
                <ul className="divide-y divide-[#1c2821]/9 dark:divide-white/8">
                  {visibleMembers.map((visibleMember) => (
                    <li key={visibleMember.authorId}>
                      <Link
                        href={getProfileHref(
                          visibleMember,
                          sessionMode,
                        )}
                        onClick={() => setActiveList(null)}
                        className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1c2821]/5 dark:hover:bg-white/5 ${focusRing}`}
                      >
                        <CampusAuthorAvatar
                          author={visibleMember.author}
                          authorId={visibleMember.authorId}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">
                            {visibleMember.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-[#58635c] dark:text-[#aeb4af]">
                            @{visibleMember.username}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-black">
                    {activeList === "followers"
                      ? "Henüz takipçi yok"
                      : "Henüz kimse takip edilmiyor"}
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
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
