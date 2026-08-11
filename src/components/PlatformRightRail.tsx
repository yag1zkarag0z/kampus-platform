"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CampusMemberSearch from "@/components/CampusMemberSearch";
import CampusTrendingTopics from "@/components/CampusTrendingTopics";
import FollowSuggestions from "@/components/FollowSuggestions";
import { useFeedback } from "@/components/FeedbackProvider";

const STORAGE_KEY = "kampus-right-rail-open";
const footerActionClassName =
  "inline-flex min-h-9 items-center py-2 text-[11px] font-semibold leading-none text-white/40 outline-none transition-colors hover:text-brand focus-visible:ring-3 focus-visible:ring-brand/40";

/**
 * Sağ sütun, sol menü gibi katlanabilir.
 *
 * Takvim ve öneriler her zaman gerekli değil; kullanıcı kapattığında tercih
 * saklanır ve okuma alanı genişler.
 */
export default function PlatformRightRail() {
  const [isOpen, setIsOpen] = useState(true);
  const { openFeedback } = useFeedback();

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
    <div className="sticky top-0 space-y-3 p-3 2xl:pr-2 2xl:pl-6">
      {/* Takvim önce: kayıt ve sınav tarihleri zamana duyarlı, kaçırılırsa
          telafisi yok. Takip önerisi her zaman geçerli, altta kalabilir. */}
      <div id="platform-right-rail-content" hidden={!isOpen}>
        <div className="space-y-5">
          <CampusMemberSearch />
          <CampusTrendingTopics />
          <FollowSuggestions />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2">
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <button
            type="button"
            onClick={openFeedback}
            className={`${footerActionClassName} cursor-pointer`}
          >
            Geri bildirim
          </button>
          <Link
            href="/sozlesme"
            className={footerActionClassName}
          >
            Kullanım sözleşmesi
          </Link>
        </div>

        {/* Panel kapatma en dikkat çekici öğe olmamalı; içeriğin altında. */}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="platform-right-rail-content"
          onClick={toggle}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 py-2 text-[11px] font-semibold text-white/40 outline-none transition-colors hover:text-white/70 focus-visible:ring-3 focus-visible:ring-brand/40"
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
