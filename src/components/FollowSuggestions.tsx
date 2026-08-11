"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import FollowActionButton from "@/components/FollowActionButton";
import FollowSuggestionDeck from "@/components/FollowSuggestionDeck";
import FollowSuggestionHoverCard, {
  useFollowHoverCard,
} from "@/components/FollowSuggestionHoverCard";
import FollowSuggestionReason from "@/components/FollowSuggestionReason";
import type { SuggestionEntry } from "@/components/followSuggestionEntry";
import { useActionStatus } from "@/components/useActionStatus";
import { useFollowState } from "@/components/useFollowState";
import {
  useGuestSuggestedMembers,
  useRealSuggestedMembers,
} from "@/components/useSuggestedMembers";

const RAIL_SUGGESTION_COUNT = 4;
const PAGE_SUGGESTION_COUNT = 20;

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/**
 * Takip edildikten sonra satır listeden düşmez; buton durum değiştirir.
 * Kaybolan satır, kullanıcının kimi takip ettiğini doğrulamasını engelliyordu.
 */
function SuggestionRow({
  entry,
  index,
  isFollowed,
  onToggleFollow,
}: {
  entry: SuggestionEntry;
  index: number;
  isFollowed: boolean;
  onToggleFollow: () => void;
}) {
  const { isOpen, containerProps } = useFollowHoverCard();

  return (
    <li
      className="campus-rail-enter"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div
        {...containerProps}
        className="group relative flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.035]"
      >
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
            <span className="block truncate text-sm font-black tracking-[-0.01em] transition-colors group-hover:text-brand">
              {entry.displayName}
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-semibold text-white/50">
              @{entry.username}
            </span>
            <FollowSuggestionReason entry={entry} className="mt-1" />
          </span>
        </Link>

        <FollowActionButton
          displayName={entry.displayName}
          isFollowed={isFollowed}
          onToggle={onToggleFollow}
        />

        {isOpen && <FollowSuggestionHoverCard entry={entry} />}
      </div>
    </li>
  );
}

export default function FollowSuggestions({
  className = "",
}: {
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionMode } = useCampusAccount();
  const guest = useGuestSuggestedMembers(RAIL_SUGGESTION_COUNT);
  const real = useRealSuggestedMembers(RAIL_SUGGESTION_COUNT, sessionMode);
  const isMember = sessionMode === "member";
  const { isHydrated, suggestions } = isMember ? real : guest;
  const [status, setStatus] = useActionStatus();

  const handleGuestAttempt = useCallback(() => {
    setStatus({
      message: "Takip etmek için giriş yapmalısın.",
      tone: "error",
      action: { label: "Giriş yap", onClick: () => router.push("/giris") },
    });
  }, [router, setStatus]);

  const handleError = useCallback(
    (message: string) => setStatus({ message, tone: "error" }),
    [setStatus],
  );

  const { followedIds, toggleFollow } = useFollowState({
    sessionMode,
    onGuestAttempt: handleGuestAttempt,
    onError: handleError,
  });

  if (pathname === "/takip") {
    return null;
  }

  // Kart yok: kutu, kenarlık ve arka plan olmadan sağ sütuna doğrudan
  // oturuyor; sadece başlık ve düz bir satır listesi.
  return (
    <aside aria-labelledby="follow-suggestions-title" className={className}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2
          id="follow-suggestions-title"
          className="min-w-0 truncate text-lg font-black tracking-[-0.035em]"
        >
          Takip önerileri
        </h2>
        {isMember && isHydrated && (
          <button
            type="button"
            onClick={real.reload}
            disabled={real.isRefreshing}
            aria-label="Önerileri yenile"
            className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-default disabled:text-white/25 ${focusRing}`}
          >
            <RefreshIcon isSpinning={real.isRefreshing} />
          </button>
        )}
      </div>

      {!isHydrated ? (
        <SuggestionsRailSkeleton />
      ) : suggestions.length > 0 ? (
        <>
          <ul className="mt-2 -mx-1 flex flex-col">
            {suggestions.map((entry, index) => (
              <SuggestionRow
                key={entry.id}
                entry={entry}
                index={index}
                isFollowed={followedIds.has(entry.id)}
                onToggleFollow={() => void toggleFollow(entry)}
              />
            ))}
          </ul>

          {status && <ActionStatusText status={status} className="mt-2 px-1" />}

          <Link
            href="/takip"
            className={`mt-2 block border-t border-white/8 px-1 pt-3 text-xs font-bold text-brand transition-colors hover:text-brand-hover ${focusRing}`}
          >
            Tümünü gör
          </Link>
        </>
      ) : (
        <RailEmptyState />
      )}
    </aside>
  );
}

function SuggestionsRailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mt-2 -mx-1"
    >
      {Array.from({ length: RAIL_SUGGESTION_COUNT }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2.5">
          <SkeletonBlock className="size-10 shrink-0" />
          <span className="min-w-0 flex-1">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-2 h-2.5 w-16" />
            <SkeletonBlock className="mt-2 h-2.5 w-30" />
          </span>
          <SkeletonBlock className="h-9 w-23 shrink-0" />
        </div>
      ))}
      <span className="sr-only">Takip önerileri yükleniyor…</span>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-white/9 motion-reduce:animate-none ${className}`}
    />
  );
}

function RailEmptyState() {
  return (
    <div className="mt-4 px-1">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full border border-white/11 text-brand"
      >
        <SparkIcon />
      </span>
      <p className="mt-3 text-sm font-black tracking-[-0.02em]">
        Hepsini keşfettin
      </p>
      <p className="mt-1 text-[13px] leading-5 text-white/50">
        Şu an önerebileceğimiz yeni bir kullanıcı yok.
      </p>
    </div>
  );
}

export function FollowSuggestionsPage() {
  const router = useRouter();
  const [status, setStatus] = useActionStatus();
  const { sessionMode } = useCampusAccount();
  const guest = useGuestSuggestedMembers(PAGE_SUGGESTION_COUNT);
  const real = useRealSuggestedMembers(PAGE_SUGGESTION_COUNT, sessionMode);
  const isMember = sessionMode === "member";
  const { isHydrated, suggestions } = isMember ? real : guest;

  // Bildirim yerine doğrudan yönlendirme: telefonda uyarı metninin kaçırılması
  // misafiri girişe ulaşamaz halde bırakıyordu.
  const handleGuestAttempt = useCallback(() => {
    router.push("/giris");
  }, [router]);

  const handleError = useCallback(
    (message: string) => setStatus({ message, tone: "error" }),
    [setStatus],
  );

  const { followedIds, toggleFollow } = useFollowState({
    sessionMode,
    onGuestAttempt: handleGuestAttempt,
    onError: handleError,
  });

  return (
    <section
      aria-labelledby="follow-suggestions-page-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-canvas text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-canvas/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff8968]">
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
              onFollow={(entry) => void toggleFollow(entry)}
            />
            {status && (
              <ActionStatusText status={status} className="mt-3 text-center" />
            )}
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
      <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-white/[0.025] motion-reduce:animate-none" />
      <div className="mt-7 h-5 w-44 animate-pulse rounded-full bg-white/6 motion-reduce:animate-none" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-60 animate-pulse rounded-2xl border border-white/8 bg-white/[0.025] motion-reduce:animate-none"
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
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/12 bg-white/[0.025] text-[#ff8968]"
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

function RefreshIcon({ isSpinning }: { isSpinning: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 ${isSpinning ? "animate-spin motion-reduce:animate-none" : ""}`}
    >
      <path d="M16.4 8.6A6.6 6.6 0 0 0 5.1 6.1L3.4 7.8" />
      <path d="M3.6 11.4a6.6 6.6 0 0 0 11.3 2.5l1.7-1.7" />
      <path d="M3.4 4.6v3.2h3.2M16.6 15.4v-3.2h-3.2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M10 2.8c.5 3 2.2 4.7 5.2 5.2-3 .5-4.7 2.2-5.2 5.2C9.5 10.2 7.8 8.5 4.8 8c3-.5 4.7-2.2 5.2-5.2ZM15.4 12.7c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}
