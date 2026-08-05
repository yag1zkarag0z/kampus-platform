"use client";

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
    <div className="sticky top-0 max-h-svh space-y-3 overflow-y-auto p-3">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="platform-right-rail-content"
        onClick={toggle}
        className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-xs font-bold text-white/55 outline-none transition-colors hover:bg-white/8 hover:text-white focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40"
      >
        {isOpen ? "Paneli gizle" : "Paneli göster"}
        <span
          aria-hidden="true"
          className={`text-sm transition-transform ${
            isOpen ? "" : "rotate-180"
          }`}
        >
          ›
        </span>
      </button>

      <div id="platform-right-rail-content" hidden={!isOpen}>
        <div className="space-y-3">
          <FollowSuggestions />
          <CampusCalendarWidget />
        </div>
      </div>
    </div>
  );
}
