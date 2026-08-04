"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CampusAudienceTags from "@/components/CampusAudienceTags";
import {
  calendarCategoryStyles,
  calendarFocusRing,
} from "@/components/CampusCalendarStyles";
import {
  formatEventBadge,
  formatEventDate,
  formatEventTiming,
  getEventTiming,
  getUpcomingEvents,
  type AcademicEvent,
} from "@/data/academicCalendar";

/**
 * Sağ sütundaki kompakt "yaklaşan" kartı.
 *
 * Tarih hesabı istemcide yapıldığı için sunucu ve istemci arasında saat farkı
 * kaynaklı uyuşmazlık olmaması adına liste ilk render'dan sonra doldurulur.
 */
export default function CampusCalendarWidget({
  limit = 3,
  className = "",
}: {
  limit?: number;
  className?: string;
}) {
  const [events, setEvents] = useState<AcademicEvent[]>([]);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setEvents(getUpcomingEvents("all", limit));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [limit]);

  return (
    <section
      aria-labelledby="campus-calendar-title"
      className={`rounded-[1.35rem] border border-white/10 bg-white/4 ${className}`}
    >
      <div className="border-b border-white/8 px-5 py-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
          Yaklaşan
        </p>
        <h2
          id="campus-calendar-title"
          className="mt-1 text-lg font-black tracking-[-0.035em]"
        >
          Kampüs takvimi
        </h2>
      </div>

      {events.length > 0 ? (
        <ol>
          {events.map((event) => {
            const badge = formatEventBadge(event);
            const timing = getEventTiming(event);
            const style = calendarCategoryStyles[event.category];

            return (
              <li
                key={event.id}
                className="border-b border-white/8 px-5 py-4 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center border border-white/12 bg-white/6 text-center">
                    <span className="block text-sm font-black leading-none">
                      {badge.day}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-[#ff7a45]">
                      {badge.month}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-5">
                      {event.title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-white/58">
                      <span
                        className={`inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${style.badge}`}
                      >
                        {style.label}
                      </span>
                      <span>{formatEventTiming(timing)}</span>
                    </p>
                    <CampusAudienceTags
                      audiences={event.audiences}
                      size="sm"
                      className="mt-1.5"
                    />
                    <p className="mt-1.5 text-[11px] leading-4 text-white/45">
                      {formatEventDate(event)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 py-6 text-xs leading-5 text-white/55">
          Takvim yükleniyor…
        </p>
      )}

      <Link
        href="/takvim"
        className={`block border-t border-white/8 px-5 py-3.5 text-xs font-bold text-[#ff7a45] transition-colors hover:bg-white/5 ${calendarFocusRing}`}
      >
        Tüm akademik takvim
      </Link>
    </section>
  );
}
