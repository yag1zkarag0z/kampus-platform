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
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";

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
      className="overflow-x-auto border-b border-white/8 bg-[#141720] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                  ? "bg-[#ff7a45]/15 text-[#ff7a45]"
                  : "text-white/55 hover:bg-white/6 hover:text-white"
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
