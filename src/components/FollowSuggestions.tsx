"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import FollowSuggestionDeck from "@/components/FollowSuggestionDeck";
import { useCampusFollow } from "@/components/CampusFollowProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  campusFollowMembers,
  type CampusFollowMember,
} from "@/data/campusFollows";
import {
  followMember,
  getSuggestedFollows,
  type SuggestedMemberDto,
} from "@/social/client";

type CampusSessionMode = "member" | "guest" | "signed-out";

type SuggestionEntry = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  detail?: string;
  bio?: string;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

function toEntryFromMock(member: CampusFollowMember): SuggestionEntry {
  return {
    id: member.authorId,
    username: member.username,
    displayName: member.displayName,
    avatarUrl: member.avatarDataUrl ?? null,
    detail: member.detail,
    bio: member.bio,
  };
}

function toEntryFromDto(member: SuggestedMemberDto): SuggestionEntry {
  return {
    id: member.id,
    username: member.username,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    detail: member.department,
    bio: member.bio,
  };
}

function useGuestSuggestedMembers(limit: number) {
  const { isHydrated, followingAuthorIds } = useCampusFollow();

  const suggestions = useMemo(
    () =>
      campusFollowMembers
        .filter((member) => !followingAuthorIds.has(member.authorId))
        .slice(0, limit)
        .map(toEntryFromMock),
    [followingAuthorIds, limit],
  );

  return { isHydrated, suggestions };
}

function useRealSuggestedMembers(
  limit: number,
  sessionMode: CampusSessionMode,
) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);

  useEffect(() => {
    if (sessionMode !== "member") {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsHydrated(false);
      }
    });

    getSuggestedFollows()
      .then((rows) => {
        if (!isCancelled) {
          setSuggestions(rows.slice(0, limit).map(toEntryFromDto));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [limit, sessionMode]);

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { isHydrated, suggestions, removeSuggestion };
}

/**
 * Takip edildikten sonra kart listeden düşmez; buton "Takip edildi"ye döner.
 * Kaybolan kart, kullanıcının kimi takip ettiğini doğrulamasını engelliyordu.
 */
function FollowButton({
  entry,
  compact = false,
  sessionMode,
  isFollowed,
  onFollowed,
}: {
  entry: SuggestionEntry;
  compact?: boolean;
  sessionMode: CampusSessionMode;
  isFollowed: boolean;
  onFollowed: () => void;
}) {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFollowClick = async () => {
    if (isFollowed || isSubmitting) {
      return;
    }

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

    setIsSubmitting(true);

    try {
      await followMember(entry.username);
      // Buton durumu değiştiği için ayrıca toast göstermiyoruz.
      onFollowed();
    } catch {
      showToast({
        message: "Takip işlemi şu anda tamamlanamadı.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const label = isFollowed ? "Takip edildi" : "Takip et";

  return (
    <button
      type="button"
      disabled={isSubmitting || isFollowed}
      aria-label={`${entry.displayName} kullanıcısını ${label.toLocaleLowerCase("tr-TR")}`}
      onClick={() => void handleFollowClick()}
      className={
        compact
          ? // Buton değil, düz metin bağlantısı: X'teki gibi kutusuz, yalnızca
            // renkle ayrışıyor.
            `inline-flex min-h-10 shrink-0 items-center justify-center px-1 text-sm font-black transition-colors disabled:cursor-default ${focusRing} ${
              isFollowed
                ? "text-white/40"
                : "text-[#ff7a45] hover:text-[#ff8d5e]"
            }`
          : `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-colors disabled:cursor-default ${focusRing} ${
              isFollowed
                ? "border border-[#ff7a45]/45 bg-[#ff7a45]/16 text-[#ffb695]"
                : "bg-[#ff7a45] text-[#12100e] hover:bg-[#ff8d5e] disabled:opacity-50"
            }`
      }
    >
      {!compact && (isFollowed ? <CheckIcon /> : <PersonPlusIcon />)}
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function CompactSuggestionItem({
  entry,
  sessionMode,
  isFollowed,
  onFollowed,
}: {
  entry: SuggestionEntry;
  sessionMode: CampusSessionMode;
  isFollowed: boolean;
  onFollowed: () => void;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3">
      <Link
        href={`/profil/${entry.username}`}
        aria-label={`${entry.displayName} profilini aç`}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg ${focusRing}`}
      >
        <CampusAuthorAvatar
          author={`@${entry.username}`}
          authorId={entry.id}
          avatarUrl={entry.avatarUrl}
          size="md"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black tracking-[-0.01em]">
            {entry.displayName}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-white/55">
            @{entry.username}
          </span>
        </span>
      </Link>
      <FollowButton
        entry={entry}
        compact
        sessionMode={sessionMode}
        isFollowed={isFollowed}
        onFollowed={onFollowed}
      />
    </li>
  );
}

/** Takip edilenler listeden düşmediği için durumları burada tutuluyor. */
function useFollowedIds() {
  const [followedIds, setFollowedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markFollowed = (id: string) => {
    setFollowedIds((current) => new Set(current).add(id));
  };

  return { followedIds, markFollowed };
}

export default function FollowSuggestions({
  className = "",
}: {
  className?: string;
}) {
  const pathname = usePathname();
  const { sessionMode } = useCampusAccount();
  const guest = useGuestSuggestedMembers(4);
  const real = useRealSuggestedMembers(4, sessionMode);
  const isMember = sessionMode === "member";
  const { isHydrated, suggestions } = isMember ? real : guest;
  const { followedIds, markFollowed } = useFollowedIds();

  if (pathname === "/takip" || !isHydrated) {
    return null;
  }

  // Kart yok: kutu, kenarlık ve arka plan olmadan sağ sütuna doğrudan
  // oturuyor; sadece başlık ve düz bir satır listesi.
  return (
    <aside
      aria-labelledby="follow-suggestions-title"
      className={className}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2
          id="follow-suggestions-title"
          className="text-lg font-black tracking-[-0.035em]"
        >
          Takip önerileri
        </h2>
        {suggestions.length > 0 && (
          <Link
            href="/takip"
            className={`shrink-0 text-sm font-bold text-[#ff7a45] transition-colors hover:text-[#ff8d5e] ${focusRing}`}
          >
            Tümünü gör
          </Link>
        )}
      </div>

      {suggestions.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4 px-1">
          {suggestions.map((entry) => (
            <CompactSuggestionItem
              key={entry.id}
              entry={entry}
              sessionMode={sessionMode}
              isFollowed={followedIds.has(entry.id)}
              onFollowed={() => markFollowed(entry.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 px-1 text-sm leading-6 text-white/50">
          Şu an önerebileceğimiz yeni bir kullanıcı yok.
        </p>
      )}
    </aside>
  );
}

export function FollowSuggestionsPage() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { sessionMode } = useCampusAccount();
  const guest = useGuestSuggestedMembers(20);
  const real = useRealSuggestedMembers(20, sessionMode);
  const isMember = sessionMode === "member";
  const { isHydrated, suggestions } = isMember ? real : guest;
  const { followedIds, markFollowed } = useFollowedIds();

  // Destede jest anında karar verdiği için takip isteği burada yürütülür.
  const followFromDeck = async (entry: SuggestionEntry) => {
    if (sessionMode !== "member") {
      // Bildirim yerine doğrudan yönlendirme: telefonda toast'ın kaçırılması
      // misafiri girişe ulaşamaz halde bırakıyordu.
      router.push("/giris");
      return;
    }

    try {
      await followMember(entry.username);
      markFollowed(entry.id);
    } catch {
      showToast({
        message: "Takip işlemi şu anda tamamlanamadı.",
        tone: "error",
      });
    }
  };

  return (
    <section
      aria-labelledby="follow-suggestions-page-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff9a72]">
              Topluluk
            </p>
            <h1
              id="follow-suggestions-page-title"
              className="mt-0.5 truncate text-2xl font-black tracking-[-0.04em]"
            >
              Takip önerileri
            </h1>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {isHydrated ? `${suggestions.length} profil` : "Yükleniyor"}
          </p>
        </div>
      </header>

      {!isHydrated ? (
        <SuggestionsLoading />
      ) : suggestions.length > 0 ? (
        <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {/* Telefonda yalnızca deste görünür; başlık sm altında gizli.
              Misafir ve üye aynı metni görür. */}
          <div className="hidden text-center sm:block">
            <h2 className="text-2xl font-black tracking-[-0.035em]">
              Kampüsten kişiler
            </h2>
            <p className="mt-2 text-sm font-semibold text-white/50">
              {suggestions.length} profil
            </p>
          </div>

          {/* Izgara yok: öneriler yalnızca tek tek gözden geçirilir. */}
          <div className="sm:mt-6">
            <FollowSuggestionDeck
              entries={suggestions}
              followedIds={followedIds}
              canFollow={isMember}
              onFollow={followFromDeck}
            />
          </div>

        </div>
      ) : (
        <NoSuggestionsEmptyState />
      )}
    </section>
  );
}

function SuggestionsLoading() {
  return (
    <div
      role="status"
      aria-label="Öneriler yükleniyor"
      className="px-3 py-4 sm:px-5 sm:py-6 lg:px-6"
    >
      <div className="h-64 animate-pulse rounded-[1.6rem] border border-white/8 bg-white/[0.025] motion-reduce:animate-none" />
      <div className="mt-7 h-5 w-44 animate-pulse rounded-full bg-white/6 motion-reduce:animate-none" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-60 animate-pulse rounded-[1.35rem] border border-white/8 bg-white/[0.025] motion-reduce:animate-none"
          />
        ))}
      </div>
      <span className="sr-only">Takip önerileri yükleniyor…</span>
    </div>
  );
}

function NoSuggestionsEmptyState() {
  return (
    <div className="grid min-h-[28rem] place-items-center px-5 py-14 text-center sm:px-8">
      <div className="max-w-sm">
        <span
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/12 bg-white/[0.025] text-[#ff9a72]"
        >
          <SparkIcon />
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          Hepsini keşfettin
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Şu an önerebileceğimiz yeni bir kullanıcı yok.
        </p>
      </div>
    </div>
  );
}

function PersonPlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <circle
        cx="7.5"
        cy="6.3"
        r="2.6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 15.3c.4-2.8 1.9-4.2 4-4.2s3.6 1.4 4 4.2M14.8 6.8v5M12.3 9.3h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="M10 2.8c.5 3 2.2 4.7 5.2 5.2-3 .5-4.7 2.2-5.2 5.2C9.5 10.2 7.8 8.5 4.8 8c3-.5 4.7-2.2 5.2-5.2ZM15.4 12.7c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

