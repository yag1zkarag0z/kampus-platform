"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

/** Karar için gereken yatay sürükleme mesafesi. */
const SWIPE_THRESHOLD = 96;

/** Kartın ekrandan çıkma süresi; geri yaylanma da aynı eğriyi kullanır. */
const LEAVE_DURATION = 320;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

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
  canFollow,
  onFollow,
}: {
  entries: DeckEntry[];
  followedIds: ReadonlySet<string>;
  /** Misafirse takip düğmesi yerine doğrudan giriş bağlantısı gösterilir. */
  canFollow: boolean;
  onFollow: (entry: DeckEntry) => Promise<void> | void;
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

      // Misafir girişe yönlendirildiği için kart yerinde kalmalı; aksi halde
      // deste geri dönüşü olmayan şekilde tükenirdi.
      if (!canFollow) {
        setDragX(0);
        return;
      }
    }

    if (prefersReducedMotion()) {
      advance();
      return;
    }

    setLeaving(decision);
    setDragX(decision === "follow" ? 560 : -560);
    window.setTimeout(advance, LEAVE_DURATION);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving || pointerIdRef.current !== null) {
      return;
    }

    // Bağlantı ve düğmelerin üstünde sürükleme başlatma: setPointerCapture
    // bütün işaretçi olaylarını karta çeker ve tıklama hiç ulaşmaz.
    if (
      event.target instanceof Element &&
      event.target.closest("a, button")
    ) {
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
      {/* İlerleme çubuğu: destenin neresinde olduğun tek bakışta görünsün. */}
      <div className="px-1 pb-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-white/50">
            {isDone ? entries.length : index + 1} / {entries.length}
          </p>
          <p className="text-xs font-bold text-[#ff9a72]">
            {followedIds.size} takip
          </p>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[#ff7a45]"
            style={{
              width: `${((isDone ? entries.length : index) / entries.length) * 100}%`,
              transition: `width ${LEAVE_DURATION}ms ${EASE_OUT}`,
            }}
          />
        </div>
      </div>

      {isDone ? (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#151a26] to-[#10141d] px-6 py-14 text-center">
          <p className="text-xl font-black tracking-[-0.035em]">
            Hepsini gözden geçirdin
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/55">
            {followedIds.size > 0
              ? `${followedIds.size} kişiyi takip etmeye başladın. Yeni öneriler biriktikçe burada görünecek.`
              : "Yeni öneriler biriktikçe burada görünecek."}
          </p>
          <Link
            href="/akis"
            className={`mt-6 inline-flex min-h-12 cursor-pointer items-center rounded-full bg-white px-6 text-sm font-black text-[#12100e] transition-colors hover:bg-[#ffede6] ${focusRing}`}
          >
            Akışa dön
          </Link>
        </div>
      ) : (
        <div className="relative h-[30rem]">
          {/* Arkadaki kart, öndeki uzaklaştıkça öne çıkar. */}
          {nextEntry && (
            <article
              aria-hidden="true"
              style={{
                transform: `scale(${0.94 + Math.min(Math.abs(dragX) / 560, 1) * 0.06})`,
                opacity: 0.5 + Math.min(Math.abs(dragX) / 560, 1) * 0.5,
                transition: isDragging
                  ? "none"
                  : `transform ${LEAVE_DURATION}ms ${EASE_OUT}, opacity ${LEAVE_DURATION}ms ${EASE_OUT}`,
              }}
              className="absolute inset-x-2 top-2 bottom-0 rounded-3xl border border-white/10 bg-gradient-to-b from-[#141926] to-[#0f131c]"
            />
          )}

          <article
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              // translate3d GPU katmanına alır: sürükleme takılmadan aksın.
              transform: `translate3d(${dragX}px, ${Math.abs(dragX) * 0.06}px, 0) rotate(${dragX * 0.045}deg)`,
              opacity: leaving ? 0 : 1,
              transition: isDragging
                ? "none"
                : `transform ${LEAVE_DURATION}ms ${EASE_OUT}, opacity ${LEAVE_DURATION}ms ${EASE_OUT}`,
              willChange: "transform",
            }}
            className="absolute inset-0 flex cursor-grab touch-pan-y flex-col overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-[#171d2b] to-[#10141d] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_30px_60px_-30px_rgba(0,0,0,0.95)] select-none active:cursor-grabbing"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ff7a45]/55 to-transparent" />

            {/* Sürükleme yönünü kart üzerinde göster. Renkler tema
                paletinden: onay turuncu, geçme nötr gri. */}
            <span
              aria-hidden="true"
              style={{
                transform: `rotate(-8deg) scale(${intent === "follow" ? 1 : 0.85})`,
                transition: `opacity 180ms ease-out, transform 180ms ${EASE_OUT}`,
              }}
              className={`pointer-events-none absolute top-6 left-6 rounded-lg border-2 border-[#ff7a45] bg-[#ff7a45]/12 px-3 py-1 font-mono text-sm font-black uppercase text-[#ff9a72] ${
                intent === "follow" ? "opacity-100" : "opacity-0"
              }`}
            >
              Takip
            </span>
            <span
              aria-hidden="true"
              style={{
                transform: `rotate(8deg) scale(${intent === "skip" ? 1 : 0.85})`,
                transition: `opacity 180ms ease-out, transform 180ms ${EASE_OUT}`,
              }}
              className={`pointer-events-none absolute top-6 right-6 rounded-lg border-2 border-white/45 bg-white/8 px-3 py-1 font-mono text-sm font-black uppercase text-white/75 ${
                intent === "skip" ? "opacity-100" : "opacity-0"
              }`}
            >
              Geç
            </span>

            {/* min-h-0 olmadan taşan içerik alttaki bağlantıyı kartın
                dışına itiyor ve overflow-hidden onu kesiyordu. */}
            <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-8 text-center sm:pt-12">
              <CampusAuthorAvatar
                author={`@${entry.username}`}
                authorId={entry.id}
                avatarUrl={entry.avatarUrl}
                size="md"
                className="size-20 text-xl ring-4 ring-white/[0.06] sm:size-24 sm:text-2xl"
              />

              <h2 className="mt-4 max-w-full truncate text-2xl font-black tracking-[-0.04em]">
                {entry.displayName}
              </h2>
              <p className="mt-1 max-w-full truncate text-sm font-bold text-[#ff9a72]">
                @{entry.username}
              </p>
              {entry.detail && (
                <p className="mt-2.5 inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/62">
                  {entry.detail}
                </p>
              )}

              <p className="mt-4 line-clamp-4 max-w-sm text-base leading-6 text-white/78">
                {entry.bio?.trim() || "Henüz biyografi eklememiş."}
              </p>

              <Link
                href={`/profil/${entry.username}`}
                className={`mt-auto mb-4 min-h-11 shrink-0 py-2 text-xs font-black text-white/55 transition-colors hover:text-white ${focusRing}`}
              >
                Profilin tamamını gör →
              </Link>
            </div>

            {/* Jest tek yol değil: klavye ve ekran okuyucu için düğmeler. */}
            <div className="flex items-center gap-3 border-t border-white/8 px-5 py-4">
              <button
                type="button"
                onClick={() => decide("skip")}
                className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-white/12 text-sm font-black text-white/70 transition-colors hover:border-white/25 hover:bg-white/6 hover:text-white ${focusRing}`}
              >
                Geç
              </button>
              {/* Misafir ve üye aynı düğmeyi görür; fark yalnızca tıklamanın
                  sonucunda: misafir girişe yönlendirilir, kart ilerlemez. */}
              <button
                type="button"
                onClick={() => decide("follow")}
                className={`inline-flex min-h-12 flex-[1.2] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-black transition-colors ${focusRing} ${
                  followedIds.has(entry.id)
                    ? "border border-[#ff7a45]/45 bg-[#ff7a45]/16 text-[#ffb695]"
                    : "bg-[#ff7a45] text-[#12100e] hover:bg-[#ff8d5e]"
                }`}
              >
                {followedIds.has(entry.id) ? (
                  <>
                    <DeckCheckIcon />
                    Takip edildi
                  </>
                ) : (
                  "Takip et"
                )}
              </button>
            </div>
          </article>
        </div>
      )}

      {/* Telefonda kaydırma zaten doğal jest; ipucu yalnızca fareyle
          kullanılan geniş ekranlarda gösteriliyor. */}
      {!isDone && (
        <p className="mt-3 hidden text-center text-xs text-white/40 sm:block">
          Kartı sağa sürükle takip et, sola sürükle geç.
        </p>
      )}
    </div>
  );
}

function DeckCheckIcon() {
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
