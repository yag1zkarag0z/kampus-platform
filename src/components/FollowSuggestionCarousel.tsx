"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import FollowActionButton from "@/components/FollowActionButton";
import FollowSuggestionReason from "@/components/FollowSuggestionReason";
import type { SuggestionEntry } from "@/components/followSuggestionEntry";
import { useActionStatus } from "@/components/useActionStatus";
import { useFollowState } from "@/components/useFollowState";
import {
  useGuestSuggestedMembers,
  useRealSuggestedMembers,
} from "@/components/useSuggestedMembers";

const CAROUSEL_SUGGESTION_COUNT = 8;

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/**
 * Telefon ve tablette takip önerisinin tek yüzeyi.
 *
 * Sağ ray `xl` altında gizli olduğu için küçük ekranda öneri hiç görünmüyordu;
 * `/takip` destesine giden tek bağlantı da o rayın içindeydi. Karusel akışın
 * içinde durduğundan kullanıcının bir yere gitmesi gerekmiyor.
 *
 * `xl` ve üstünde render edilmez: orada sağ ray zaten aynı listeyi gösteriyor,
 * ikisi birden aynı kişileri iki kez sunardı.
 */
export default function FollowSuggestionCarousel() {
  // Yalnızca CSS ile gizlemek yetmiyordu: `xl:hidden` görünmeyen bileşeni de
  // mount ediyor, masaüstünde sağ rayla birlikte aynı öneri isteği iki kez
  // gidiyordu. Kapı burada, veri çeken parça hiç kurulmasın diye.
  const isCompactLayout = useIsCompactLayout();

  if (!isCompactLayout) {
    return null;
  }

  return <SuggestionCarousel />;
}

/** Sağ rayın belirdiği kırılım; altında öneriyi taşıyan tek yüzey akış. */
function useIsCompactLayout() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279.98px)");
    const sync = () => setIsCompact(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  return isCompact;
}

function SuggestionCarousel() {
  const router = useRouter();
  const { sessionMode } = useCampusAccount();
  const guest = useGuestSuggestedMembers(CAROUSEL_SUGGESTION_COUNT);
  const real = useRealSuggestedMembers(CAROUSEL_SUGGESTION_COUNT, sessionMode);
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

  // Yüklenirken hiç yer tutmuyor: akışın ortasında bir iskelet belirip
  // kaybolmak, okunan gönderiyi ekrandan kaydırırdı.
  if (!isHydrated || suggestions.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="follow-suggestion-carousel-title"
      className="border-b border-white/12 py-5 sm:bg-white/[0.015] xl:hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6">
        <h2
          id="follow-suggestion-carousel-title"
          className="min-w-0 truncate text-lg font-black tracking-[-0.035em]"
        >
          Takip önerileri
        </h2>
        <Link
          href="/takip"
          className={`group flex shrink-0 items-center gap-1 rounded-full text-sm font-bold text-brand transition-colors hover:text-brand-hover ${focusRing}`}
        >
          Tümünü gör
          <span
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>

      {status && (
        <ActionStatusText status={status} className="mt-2 px-4 sm:px-6" />
      )}

      {/* Kaydırma ipucu: son kart kenardan taşarak devamı olduğunu gösteriyor,
          bu yüzden sağdaki boşluk kartın kendisiyle veriliyor. */}
      <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {suggestions.map((entry) => (
          <SuggestionCard
            key={entry.id}
            entry={entry}
            isFollowed={followedIds.has(entry.id)}
            onToggleFollow={() => void toggleFollow(entry)}
          />
        ))}
      </ul>
    </section>
  );
}

function SuggestionCard({
  entry,
  isFollowed,
  onToggleFollow,
}: {
  entry: SuggestionEntry;
  isFollowed: boolean;
  onToggleFollow: () => void;
}) {
  return (
    <li className="w-40 shrink-0 snap-start">
      <div className="flex h-full flex-col items-center rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-center">
        <Link
          href={`/profil/${entry.username}`}
          aria-label={`${entry.displayName} profilini aç`}
          className={`flex min-w-0 flex-col items-center rounded-xl ${focusRing}`}
        >
          <CampusAuthorAvatar
            author={`@${entry.username}`}
            authorId={entry.id}
            avatarUrl={entry.avatarUrl}
            size="lg"
          />
          <span className="mt-2.5 block w-full truncate text-sm font-black tracking-[-0.01em]">
            {entry.displayName}
          </span>
          <span className="mt-0.5 block w-full truncate text-[13px] font-semibold text-white/50">
            @{entry.username}
          </span>
        </Link>

        {/* Gerekçe iki kartta farklı yükseklikte olmasın diye sabit alan. */}
        <div className="mt-2 flex h-9 w-full items-center justify-center">
          <FollowSuggestionReason
            entry={entry}
            wrap
            className="justify-center text-center"
          />
        </div>

        <FollowActionButton
          displayName={entry.displayName}
          isFollowed={isFollowed}
          onToggle={onToggleFollow}
          className="mt-auto w-full"
        />
      </div>
    </li>
  );
}
