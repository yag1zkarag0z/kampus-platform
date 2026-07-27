"use client";

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
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:focus-visible:ring-[#c7896d]/30";

type CampusCategoryNavProps = {
  activeCategory: CampusCategoryFilter;
  ariaLabel: string;
  onCategoryChange: (category: CampusCategoryFilter) => void;
};

export default function CampusCategoryNav({
  activeCategory,
  ariaLabel,
  onCategoryChange,
}: CampusCategoryNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="overflow-x-auto border-b border-[#1c2821]/10 bg-[#f1ece4] [scrollbar-width:none] dark:border-white/8 dark:bg-[#1d2023] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max gap-1 px-1.5 sm:min-w-full">
        {campusCategoryFilters.map((category) => {
          const isActive = activeCategory === category;

          return (
            <button
              key={category}
              type="button"
              aria-pressed={isActive}
              onClick={() => onCategoryChange(category)}
              className={`inline-flex min-h-11 flex-none items-center justify-center px-3 text-center text-[11px] font-bold whitespace-nowrap transition-colors sm:flex-1 sm:px-2 sm:text-xs ${focusRing} ${
                isActive
                  ? "bg-[#ddd2c7] text-[#5a1f32] dark:bg-[#2c3034] dark:text-[#d09272]"
                  : "text-[#1c2821]/58 hover:bg-[#e8e0d7] hover:text-[#1c2821] dark:text-white/54 dark:hover:bg-white/6 dark:hover:text-white"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
