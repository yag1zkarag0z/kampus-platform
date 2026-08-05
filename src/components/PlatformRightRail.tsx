"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CampusCalendarWidget from "@/components/CampusCalendarWidget";
import FollowSuggestions from "@/components/FollowSuggestions";

const STORAGE_KEY = "kampus-right-rail-open";

/**
 * Sağ sütun, sol menü gibi katlanabilir.
 *
 * Takvim ve öneriler her zaman gerekli değil; kullanıcı kapattığında tercih
 * saklanır ve okuma alanı genişler.
 */
export default function PlatformRightRail() {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        setIsOpen(window.localStorage.getItem(STORAGE_KEY) !== "false");
      } catch {
        // Depolama kapalıysa varsayılan açık kalır.
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const toggle = () => {
    setIsOpen((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Tercih saklanamazsa yalnızca bu oturum için geçerli olur.
      }

      return next;
    });
  };

  return (
    <div className="sticky top-0 space-y-3 p-3">
      {/* Takvim önce: kayıt ve sınav tarihleri zamana duyarlı, kaçırılırsa
          telafisi yok. Takip önerisi her zaman geçerli, altta kalabilir. */}
      <div id="platform-right-rail-content" hidden={!isOpen}>
        <div className="space-y-3">
          <CampusCalendarWidget />
          <FollowSuggestions />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2">
        <Link
          href="/sozlesme"
          className="min-h-9 py-2 text-[11px] font-semibold text-white/40 outline-none transition-colors hover:text-white/70 focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40"
        >
          Kullanım sözleşmesi
        </Link>

        {/* Panel kapatma en dikkat çekici öğe olmamalı; içeriğin altında. */}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="platform-right-rail-content"
          onClick={toggle}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 py-2 text-[11px] font-semibold text-white/40 outline-none transition-colors hover:text-white/70 focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40"
        >
          {isOpen ? "Paneli gizle" : "Paneli göster"}
          <span
            aria-hidden="true"
            className={`transition-transform ${isOpen ? "" : "rotate-180"}`}
          >
            ›
          </span>
        </button>
      </footer>
    </div>
  );
}
