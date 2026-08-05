"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

/** Karar için gereken yatay sürükleme mesafesi. */
const SWIPE_THRESHOLD = 96;

export type DeckEntry = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  detail?: string;
  bio?: string;
};

type Decision = "follow" | "skip";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Kaydırmalı öneri destesi.
 *
 * Sürükleme tek bir işaretçiyle yürütülür; eşiği aşınca karar verilir, aşmazsa
 * kart yerine döner. Sürükleme dokunmatik olmayan cihazlarda da çalışsın diye
 * pointer olayları kullanılıyor, ayrıca klavye ve ekran okuyucu için altta
 * gerçek düğmeler var — karar yalnızca jestle alınamaz.
 */
export default function FollowSuggestionDeck({
  entries,
  followedIds,
  onFollow,
  onClose,
}: {
  entries: DeckEntry[];
  followedIds: ReadonlySet<string>;
  onFollow: (entry: DeckEntry) => Promise<void> | void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [leaving, setLeaving] = useState<Decision | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);

  const entry = entries[index];
  const nextEntry = entries[index + 1];
  const isDone = !entry;

  const advance = () => {
    setLeaving(null);
    setDragX(0);
    setIndex((current) => current + 1);
  };

  const decide = (decision: Decision) => {
    if (!entry || leaving) {
      return;
    }

    if (decision === "follow" && !followedIds.has(entry.id)) {
      void onFollow(entry);
    }

    if (prefersReducedMotion()) {
      advance();
      return;
    }

    setLeaving(decision);
    setDragX(decision === "follow" ? 520 : -520);
    window.setTimeout(advance, 220);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving || pointerIdRef.current !== null) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    setDragX(event.clientX - startXRef.current);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    pointerIdRef.current = null;
    setIsDragging(false);

    if (dragX > SWIPE_THRESHOLD) {
      decide("follow");
      return;
    }

    if (dragX < -SWIPE_THRESHOLD) {
      decide("skip");
      return;
    }

    setDragX(0);
  };

  const intent =
    dragX > SWIPE_THRESHOLD / 2
      ? "follow"
      : dragX < -SWIPE_THRESHOLD / 2
        ? "skip"
        : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <p className="text-xs font-bold text-white/50">
          {isDone
            ? `${entries.length} / ${entries.length}`
            : `${index + 1} / ${entries.length}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className={`min-h-11 cursor-pointer rounded-full px-3 text-xs font-black text-white/55 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
        >
          Listeye dön
        </button>
      </div>

      {isDone ? (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#151a26] to-[#10141d] px-6 py-14 text-center">
          <p className="text-xl font-black tracking-[-0.035em]">
            Hepsini gözden geçirdin
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/55">
            Yeni öneriler biriktikçe burada görünecek.
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`mt-6 inline-flex min-h-12 cursor-pointer items-center rounded-full bg-white px-6 text-sm font-black text-[#12100e] transition-colors hover:bg-[#ffede6] ${focusRing}`}
          >
            Listeye dön
          </button>
        </div>
      ) : (
        <div className="relative h-[30rem]">
          {/* Arkadaki kart destenin devam ettiğini gösterir. */}
          {nextEntry && (
            <article
              aria-hidden="true"
              className="absolute inset-x-3 top-3 bottom-0 scale-[0.97] rounded-3xl border border-white/8 bg-[#12161f] opacity-60"
            />
          )}

          <article
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
              transition: isDragging ? "none" : "transform 220ms ease-out",
            }}
            className="absolute inset-0 flex cursor-grab touch-pan-y flex-col overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-[#171d2b] to-[#10141d] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_30px_60px_-30px_rgba(0,0,0,0.95)] select-none active:cursor-grabbing"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ff7a45]/55 to-transparent" />

            {/* Sürükleme yönünü kart üzerinde göster. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-6 left-6 rounded-lg border-2 px-3 py-1 font-mono text-sm font-black uppercase transition-opacity ${
                intent === "follow"
                  ? "border-[#7fd9a3] text-[#7fd9a3] opacity-100"
                  : "opacity-0"
              }`}
            >
              Takip
            </span>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-6 right-6 rounded-lg border-2 px-3 py-1 font-mono text-sm font-black uppercase transition-opacity ${
                intent === "skip"
                  ? "border-[#ffb199] text-[#ffb199] opacity-100"
                  : "opacity-0"
              }`}
            >
              Geç
            </span>

            <div className="flex flex-1 flex-col items-center px-6 pt-12 text-center">
              <CampusAuthorAvatar
                author={`@${entry.username}`}
                authorId={entry.id}
                avatarUrl={entry.avatarUrl}
                size="md"
                className="size-24 text-2xl ring-4 ring-white/[0.06]"
              />

              <h2 className="mt-5 max-w-full truncate text-2xl font-black tracking-[-0.04em]">
                {entry.displayName}
              </h2>
              <p className="mt-1 max-w-full truncate text-sm font-bold text-[#ff9a72]">
                @{entry.username}
              </p>
              {entry.detail && (
                <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/62">
                  {entry.detail}
                </p>
              )}

              <p className="mt-5 max-w-sm text-base leading-7 text-white/78">
                {entry.bio?.trim() || "Henüz biyografi eklememiş."}
              </p>

              <Link
                href={`/profil/${entry.username}`}
                className={`mt-auto mb-5 min-h-11 py-2 text-xs font-black text-white/50 transition-colors hover:text-white ${focusRing}`}
              >
                Profilin tamamını gör →
              </Link>
            </div>

            {/* Jest tek yol değil: klavye ve ekran okuyucu için düğmeler. */}
            <div className="flex items-center gap-3 border-t border-white/8 px-5 py-4">
              <button
                type="button"
                onClick={() => decide("skip")}
                className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-white/12 text-sm font-black text-white/70 transition-colors hover:border-[#ffb199]/40 hover:bg-[#ffb199]/8 hover:text-white ${focusRing}`}
              >
                Geç
              </button>
              <button
                type="button"
                onClick={() => decide("follow")}
                className={`inline-flex min-h-12 flex-[1.2] cursor-pointer items-center justify-center rounded-xl bg-white text-sm font-black text-[#12100e] transition-colors hover:bg-[#ffede6] ${focusRing}`}
              >
                {followedIds.has(entry.id) ? "Takip edildi" : "Takip et"}
              </button>
            </div>
          </article>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-white/40">
        Kartı sağa sürükle takip et, sola sürükle geç.
      </p>
    </div>
  );
}
