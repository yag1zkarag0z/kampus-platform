"use client";

import {
  calendarCategoryStyles,
  calendarFocusRing,
  calendarTile,
} from "@/components/CampusCalendarStyles";
import {
  getEventEndDate,
  parseCalendarDate,
  startOfDay,
  type AcademicCategory,
  type AcademicEvent,
} from "@/data/academicCalendar";

const WEEKDAY_LABELS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

const monthYearFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
});

type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  categories: AcademicCategory[];
};

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** JS'te Pazar=0 döner; bu, Pazartesi=0 ... Pazar=6 sıralamasına çevirir. */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function buildMonthGrid(month: Date, events: AcademicEvent[]): DayCell[] {
  const firstOfMonth = startOfMonth(month);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - mondayIndex(firstOfMonth));

  const cells: DayCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);

    const categories = Array.from(
      new Set(
        events
          .filter((event) => {
            const start = parseCalendarDate(event.start);
            const end = getEventEndDate(event);
            return date >= start && date <= end;
          })
          .map((event) => event.category),
      ),
    );

    cells.push({
      date,
      inCurrentMonth: date.getMonth() === firstOfMonth.getMonth(),
      categories,
    });
  }

  // Ayın son haftası tamamen bir sonraki aya aitse satırı kaldır (5 hafta yeter).
  while (
    cells.length > 35 &&
    cells.slice(-7).every((cell) => !cell.inCurrentMonth)
  ) {
    cells.splice(-7, 7);
  }

  return cells;
}

/**
 * Masaüstünde ajanda listesinin yanına oturan kompakt ay takvimi. Günler
 * tıklanabilir; o günün etkinlikleri ajandada gösterilir. Mobilde
 * kullanılmaz (bkz. CampusCalendar.tsx'teki md:hidden/hidden md:flex ayrımı).
 */
export default function CampusCalendarMonthGrid({
  month,
  onMonthChange,
  onJumpToToday,
  events,
  selectedDate,
  onSelectDate,
  className = "",
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  onJumpToToday: () => void;
  events: AcademicEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  className?: string;
}) {
  const today = startOfDay(new Date());
  const cells = buildMonthGrid(month, events);

  return (
    <div className={`min-w-0 p-3.5 ${calendarTile} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black tracking-[-0.02em] capitalize">
          {monthYearFormatter.format(month)}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Önceki ay"
            onClick={() => onMonthChange(addMonths(month, -1))}
            className={`grid size-7 place-items-center border border-white/12 text-white/70 transition-colors hover:bg-white/6 ${calendarFocusRing}`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Sonraki ay"
            onClick={() => onMonthChange(addMonths(month, 1))}
            className={`grid size-7 place-items-center border border-white/12 text-white/70 transition-colors hover:bg-white/6 ${calendarFocusRing}`}
          >
            ›
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onJumpToToday}
        className={`mt-2 text-[11px] font-bold text-[#ff7a45] transition-colors hover:text-[#ff8d5e] ${calendarFocusRing}`}
      >
        Bugüne git
      </button>

      <div
        aria-hidden="true"
        className="mt-3 grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-white/40"
      >
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div
        role="grid"
        aria-label={monthYearFormatter.format(month)}
        className="mt-1 grid grid-cols-7 gap-1"
      >
        {cells.map((cell) => {
          const isToday = cell.date.getTime() === today.getTime();
          const isSelected =
            selectedDate !== null &&
            cell.date.getTime() === selectedDate.getTime();

          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              role="gridcell"
              onClick={() => onSelectDate(isSelected ? null : cell.date)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className={`flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${calendarFocusRing} ${
                !cell.inCurrentMonth
                  ? "text-white/20 hover:bg-white/[0.03]"
                  : isSelected
                    ? "bg-white text-[#12100e]"
                    : isToday
                      ? "border border-[#ff7a45]/45 text-[#ffb694] hover:bg-[#ff7a45]/10"
                      : "text-white/78 hover:bg-white/6"
              }`}
            >
              {cell.date.getDate()}
              <span className="flex h-1 items-center gap-0.5">
                {cell.categories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    aria-hidden="true"
                    className={`size-1 rounded-full ${
                      isSelected
                        ? "bg-[#12100e]/60"
                        : calendarCategoryStyles[category].dot
                    }`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
