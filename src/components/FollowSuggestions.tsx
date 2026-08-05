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
          ? `inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border px-3 text-[11px] font-black transition-colors disabled:cursor-default ${focusRing} ${
              isFollowed
                ? "border-[#7fd9a3]/30 bg-[#7fd9a3]/10 text-[#9fe0bb]"
                : "border-[#ff7a45]/25 bg-[#ff7a45]/8 text-[#ff9a72] hover:border-[#ff7a45]/45 hover:bg-[#ff7a45]/14 disabled:opacity-50"
            }`
          : `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-colors disabled:cursor-default ${focusRing} ${
              isFollowed
                ? "border border-[#7fd9a3]/30 bg-[#7fd9a3]/10 text-[#9fe0bb]"
                : "bg-white text-[#12100e] hover:bg-[#ffede6] disabled:opacity-50"
            }`
      }
    >
      {!compact && (isFollowed ? <CheckIcon /> : <PersonPlusIcon />)}
      {label}
    </button>
  );
}

function CardsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <rect x="6.4" y="3.4" width="10.2" height="13.2" rx="2" />
      <path d="M4 5.6A2 2 0 0 0 3.4 7v8.2a2 2 0 0 0 2 2h6.2" />
    </svg>
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
    <li className="flex min-w-0 items-center gap-2.5 px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
      <Link
        href={`/profil/${entry.username}`}
        aria-label={`${entry.displayName} profilini aç`}
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg ${focusRing}`}
      >
        <CampusAuthorAvatar
          author={`@${entry.username}`}
          authorId={entry.id}
          avatarUrl={entry.avatarUrl}
          size="sm"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black tracking-[-0.01em]">
            {entry.displayName}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/55">
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

function SuggestionCard({
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
    <li className="group relative isolate flex min-w-0 flex-col items-center overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#141720] p-5 text-center shadow-[0_14px_40px_rgba(0,0,0,0.16)] transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-[#ff7a45]/24 hover:bg-[#171a24] motion-reduce:transform-none sm:p-6">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-[radial-gradient(circle_at_88%_8%,rgba(255,122,69,0.16),transparent_48%)] opacity-80 transition-opacity group-hover:opacity-100"
      />

      <Link
        href={`/profil/${entry.username}`}
        aria-label={`${entry.displayName} profilini aç`}
        className={`rounded-full transition-transform hover:scale-[1.03] motion-reduce:transform-none ${focusRing}`}
      >
        <CampusAuthorAvatar
          author={`@${entry.username}`}
          authorId={entry.id}
          avatarUrl={entry.avatarUrl}
          size="md"
          className="size-16 text-base ring-4 ring-white/[0.04]"
        />
      </Link>

      <div className="mt-4 min-w-0 max-w-full">
        <Link
          href={`/profil/${entry.username}`}
          className={`inline-block max-w-full rounded-md transition-colors hover:text-[#ff9a72] ${focusRing}`}
        >
          <h2 className="truncate text-xl font-black tracking-[-0.035em] sm:text-[1.35rem]">
            {entry.displayName}
          </h2>
        </Link>
        <p className="mt-1 truncate text-sm font-bold text-[#ff9a72]">
          @{entry.username}
        </p>
        {entry.detail && (
          <p className="mt-2 truncate text-xs font-bold text-white/50">
            {entry.detail}
          </p>
        )}
        {/* Biyografi ilk bakışta görünsün: kimi takip edeceğine karar
            vermek için bölüm adı tek başına yeterli değil. */}
        <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-white/68">
          {entry.bio?.trim() || "Henüz biyografi eklememiş."}
        </p>
      </div>

      <div className="mt-5 flex w-full items-center gap-2 border-t border-white/8 pt-5">
        <Link
          href={`/profil/${entry.username}`}
          className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-black text-white/72 transition-colors hover:border-white/18 hover:bg-white/5 hover:text-white ${focusRing}`}
        >
          Profili gör
        </Link>
        <div className="flex-[1.15]">
          <FollowButton
            entry={entry}
            sessionMode={sessionMode}
            isFollowed={isFollowed}
            onFollowed={onFollowed}
          />
        </div>
      </div>
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

  // Takvim kartıyla aynı yüzey dili: sağ sütun tek bir sistem gibi dursun.
  return (
    <aside
      aria-labelledby="follow-suggestions-title"
      className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#151a26] to-[#10141d] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_18px_40px_-24px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ff7a45]/55 to-transparent" />

      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#ff7a45]/22 bg-[#ff7a45]/10 text-[#ff9a72]"
          >
            <PeopleIcon />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
              Topluluk
            </p>
            <h2
              id="follow-suggestions-title"
              className="mt-0.5 text-lg font-black tracking-[-0.035em]"
            >
              Takip önerileri
            </h2>
          </div>
        </div>
      </div>
      {suggestions.length > 0 ? (
        <>
          <ul className="divide-y divide-white/6 border-t border-white/6">
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
          <Link
            href="/takip"
            className={`group flex min-h-12 items-center justify-between border-t border-white/8 px-5 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 ${focusRing}`}
          >
            Tüm önerileri gör
            <ArrowIcon />
          </Link>
        </>
      ) : (
        <p className="px-4 py-6 text-center text-xs leading-5 text-white/50">
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
  const [isDeckOpen, setIsDeckOpen] = useState(false);

  // Destede jest anında karar verdiği için takip isteği burada yürütülür.
  const followFromDeck = async (entry: SuggestionEntry) => {
    if (sessionMode !== "member") {
      showToast({
        message: "Takip etmek için giriş yapmalısın.",
        tone: "info",
        action: { label: "Giriş yap", onClick: () => router.push("/giris") },
      });
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
          {!isMember && (
            <div className="relative isolate overflow-hidden rounded-[1.6rem] border border-[#ff7a45]/16 bg-[#141720] px-5 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:px-8 sm:py-10">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,69,0.17),transparent_46%)]"
              />

              <div className="mx-auto max-w-2xl">
                <span className="mx-auto grid size-12 place-items-center rounded-full border border-[#ff7a45]/22 bg-[#ff7a45]/9 text-[#ff9a72]">
                  <PeopleIcon />
                </span>
                <h2 className="mx-auto mt-5 max-w-xl text-3xl font-black leading-[1.08] tracking-[-0.05em] sm:text-4xl">
                  Kampüs topluluğunu keşfet
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
                  Kampüsteki öğrencilerin ve toplulukların profillerine göz
                  at. Takip etmek istediğinde giriş yapman yeterli.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <h2 className="text-2xl font-black tracking-[-0.035em]">
              {isMember ? "Bölümünden ve kampüsten kişiler" : "Kampüsten kişiler"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-white/50">
              {suggestions.length} profil
            </p>
          </div>

          {/* Izgara yok: öneriler yalnızca tek tek gözden geçirilir. */}
          <div className="mt-6">
            <FollowSuggestionDeck
              entries={suggestions}
              followedIds={followedIds}
              onFollow={followFromDeck}
            />
          </div>

          {!isMember && (
            <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-[1.35rem] border border-white/9 bg-white/[0.025] px-5 py-6 text-center sm:px-6">
              <div>
                <p className="text-lg font-black">
                  Takip etmek için giriş yap
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Giriş yaptıktan sonra istediğin profilleri takip
                  edebilirsin.
                </p>
              </div>
              <Link
                href="/giris"
                className={`inline-flex min-h-12 w-full max-w-xs shrink-0 items-center justify-center rounded-xl bg-[#ff7a45] px-6 text-sm font-black text-[#12100e] transition-colors hover:bg-[#ff956d] sm:w-auto ${focusRing}`}
              >
                Giriş yap
              </Link>
            </div>
          )}
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

function PeopleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <circle
        cx="7.2"
        cy="6.4"
        r="2.6"
        stroke="currentColor"
        strokeWidth="1.45"
      />
      <path
        d="M3.2 15.5c.4-2.9 1.9-4.4 4-4.4s3.6 1.5 4 4.4M12.5 4.5a2.5 2.5 0 0 1 0 4.8m1.2 2c1.7.4 2.7 1.8 3 4.2"
        stroke="currentColor"
        strokeWidth="1.45"
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

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
    >
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
