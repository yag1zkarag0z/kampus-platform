"use client";

import { useEffect, useRef, useState } from "react";

import type { CampusPostCategory } from "@/data/campusPosts";

export type CampusCategoryFilter = "Tümü" | CampusPostCategory;

export const campusCategoryFilters: CampusCategoryFilter[] = [
  "Tümü",
  "Sohbet",
  "İtiraf",
  "Soru",
  "Etkinlik",
  "Kayıp Eşya",
  "Anket",
  "İlan",
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";
const MENU_WIDTH = 224;
const MENU_MARGIN = 12;

type CampusCategoryNavProps = {
  activeCategory: CampusCategoryFilter;
  ariaLabel: string;
  onCategoryChange: (category: CampusCategoryFilter) => void;
  /** Kategoriden bağımsız bir ek filtre; menüye "Ders notları" satırı olarak eklenir. */
  hasDocumentOnly?: boolean;
  onToggleDocumentOnly?: () => void;
};

/**
 * Tek düğmelik, açılır menülü kategori seçici. Sekiz kategoriyi ayrı bir
 * satırda pill pill dizmek dar ekranlarda taşıyordu; artık sıralama
 * düğmeleriyle aynı satırda tek bir öğe kaplıyor.
 *
 * Menü `position: fixed` ile kendi ekran koordinatını hesaplayıp açılıyor;
 * tetikleyici düğme yatay kaydırılabilir bir satırın içinde olduğu için
 * `absolute` konumlandırma üst öğenin `overflow`'u tarafından kesiliyordu.
 */
export default function CampusCategoryNav({
  activeCategory,
  ariaLabel,
  onCategoryChange,
  hasDocumentOnly = false,
  onToggleDocumentOnly,
}: CampusCategoryNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();

    if (rect) {
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.min(
          rect.left,
          window.innerWidth - MENU_WIDTH - MENU_MARGIN,
        ),
      });
    }

    setIsMenuOpen(true);
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    // Menü ekran koordinatına sabitlendiği için kaydırma sırasında
    // tetikleyiciyle bağlantısı kopmasın diye kapatılıyor. Dinleyici bir
    // sonraki karede eklenir: tetikleyici düğme yatay kaydırılabilir bir
    // satırın içinde olduğu için odaklanınca tarayıcı onu görünüre
    // kaydırıyor — dinleyici hemen eklenirse bu kendi kaydırmasıyla
    // menüyü anında kapatıyordu.
    const closeOnScroll = () => setIsMenuOpen(false);
    const attachScrollListenerId = window.requestAnimationFrame(() => {
      window.addEventListener("scroll", closeOnScroll, true);
    });

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(attachScrollListenerId);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [isMenuOpen]);

  const isFilterActive = activeCategory !== "Tümü" || hasDocumentOnly;
  const triggerLabel =
    activeCategory !== "Tümü"
      ? activeCategory
      : hasDocumentOnly
        ? "Ders notları"
        : "Kategori";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label={ariaLabel}
        onClick={() => (isMenuOpen ? setIsMenuOpen(false) : openMenu())}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-xs font-bold whitespace-nowrap transition-colors sm:px-5 sm:text-sm ${focusRing} ${
          isFilterActive
            ? "bg-[#ff7a45]/15 text-[#ff7a45]"
            : "text-white/55 hover:bg-white/5 hover:text-white"
        }`}
      >
        {triggerLabel}
        <ChevronIcon isOpen={isMenuOpen} />
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: MENU_WIDTH,
          }}
          className="z-50 overflow-hidden rounded-2xl border border-white/12 bg-[#141720] p-2 shadow-[0_18px_48px_rgba(0,0,0,0.5)]"
        >
          {onToggleDocumentOnly && (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={hasDocumentOnly}
                onClick={() => {
                  onToggleDocumentOnly();
                  setIsMenuOpen(false);
                }}
                className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2.5 text-left text-[11px] font-black transition-colors ${focusRing} ${
                  hasDocumentOnly
                    ? "bg-[#ff7a45]/20 text-[#ff7a45]"
                    : "text-[#ff7a45]/85 hover:bg-[#ff7a45]/10 hover:text-[#ff7a45]"
                }`}
              >
                📎 Ders notları
              </button>
              <div className="my-1.5 border-t border-white/8" />
            </>
          )}
          <div className="grid grid-cols-2 gap-1">
            {campusCategoryFilters.map((category) => {
              const isActive = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onCategoryChange(category);
                    setIsMenuOpen(false);
                  }}
                  className={`inline-flex min-h-11 items-center rounded-lg px-2.5 text-left text-[11px] font-bold transition-colors ${focusRing} ${
                    isActive
                      ? "bg-[#ff7a45]/20 text-[#ff7a45]"
                      : "text-white/78 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={`size-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
    >
      <path d="m5.5 8 4.5 4.5L14.5 8" />
    </svg>
  );
}
