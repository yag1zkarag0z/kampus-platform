"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import FollowSuggestionReason from "@/components/FollowSuggestionReason";
import type { SuggestionEntry } from "@/components/followSuggestionEntry";

/** İmleç satırın üstünden geçerken kart açılmamalı. */
const OPEN_DELAY_MS = 350;
/** İmlecin satırdan karta ulaşması için tanınan süre. */
const CLOSE_DELAY_MS = 200;

/**
 * Önizleme kartının açılma/kapanma zamanlaması. Fare varsa gecikmeli, klavye
 * odağında anında; dokunmatikte hiç açılmaz çünkü orada ilk dokunuş kartı
 * açmakla harcanır ve profil bağlantısı ulaşılmaz hâle gelir.
 */
export function useFollowHoverCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHasFinePointer(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  const schedule = useCallback((next: boolean, delay: number) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (delay === 0) {
      setIsOpen(next);
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(next);
      timeoutRef.current = null;
    }, delay);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const containerProps = hasFinePointer
    ? {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => {
          if (event.pointerType === "mouse") {
            schedule(true, OPEN_DELAY_MS);
          }
        },
        onPointerLeave: (event: PointerEvent<HTMLElement>) => {
          if (event.pointerType === "mouse") {
            schedule(false, CLOSE_DELAY_MS);
          }
        },
        onFocus: () => schedule(true, 0),
        onBlur: (event: FocusEvent<HTMLElement>) => {
          // Odak satırın içinde başka bir öğeye geçtiyse kart açık kalmalı.
          if (!event.currentTarget.contains(event.relatedTarget)) {
            schedule(false, 0);
          }
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (event.key === "Escape") {
            schedule(false, 0);
          }
        },
      }
    : {};

  return { isOpen: hasFinePointer && isOpen, containerProps };
}

/**
 * Satırın yanında açılan mini profil.
 *
 * Bilerek `aria-hidden`: gösterdiği her şey satırın kendisinde ya da profil
 * sayfasında zaten var, ve içinde odaklanılabilir öğe yok. Ekran okuyucuya
 * aynı kişiyi ikinci kez okutmak sekme sırasını iki katına çıkarırdı.
 */
export default function FollowSuggestionHoverCard({
  entry,
}: {
  entry: SuggestionEntry;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [alignBottom, setAlignBottom] = useState(false);

  useLayoutEffect(() => {
    const node = cardRef.current;

    if (!node) {
      return;
    }

    // Rayın alt satırlarında kart ekranın dışına taşıyordu; taşıyorsa üste
    // hizalanıyor.
    const rect = node.getBoundingClientRect();

    if (rect.bottom > window.innerHeight - 12) {
      setAlignBottom(true);
    }
  }, []);

  const followerCount = entry.followerCount ?? 0;

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className={`campus-hover-card pointer-events-none absolute right-full z-50 mr-3 w-[19rem] overflow-hidden rounded-2xl border border-white/12 bg-surface-raised p-4 shadow-[0_16px_36px_rgba(0,0,0,0.32)] ${
        alignBottom ? "bottom-0" : "top-0"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CampusAuthorAvatar
          author={`@${entry.username}`}
          authorId={entry.id}
          avatarUrl={entry.avatarUrl}
          size="lg"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-[-0.02em]">
            {entry.displayName}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-white/50">
            @{entry.username}
          </p>
        </div>
      </div>

      {entry.bio && (
        <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-white/68">
          {entry.bio}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[13px] font-semibold text-white/50">
          <span className="font-black text-white">
            {followerCount.toLocaleString("tr-TR")}
          </span>{" "}
          takipçi
        </p>
        {entry.detail && (
          <span className="inline-flex shrink-0 items-center border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white/68">
            {entry.detail}
          </span>
        )}
      </div>

      {(entry.mutualCount ?? 0) > 0 && (
        <FollowSuggestionReason
          entry={entry}
          className="mt-3 border-t border-white/8 pt-3"
        />
      )}
    </div>
  );
}
