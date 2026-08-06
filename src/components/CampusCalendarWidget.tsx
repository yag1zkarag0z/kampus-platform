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

  // Öneriler listesiyle aynı dil: kart yok, kenarlık yok, sağ sütuna
  // doğrudan oturan düz bir liste.
  return (
    <section aria-labelledby="campus-calendar-title" className={className}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2
          id="campus-calendar-title"
          className="text-lg font-black tracking-[-0.035em]"
        >
          Kampüs takvimi
        </h2>
        {events.length > 0 && (
          <Link
            href="/takvim"
            className={`shrink-0 text-sm font-bold text-[#ff7a45] transition-colors hover:text-[#ff8d5e] ${calendarFocusRing}`}
          >
            Tümünü gör
          </Link>
        )}
      </div>

      {events.length > 0 ? (
        <ol className="mt-4 flex flex-col gap-4 px-1">
          {events.map((event) => {
            const badge = formatEventBadge(event);
            const timing = getEventTiming(event);
            const style = calendarCategoryStyles[event.category];

            return (
              <li key={event.id} className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#ff7a45]/18 bg-[#ff7a45]/5 text-center">
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
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 px-1 text-sm leading-6 text-white/50">
          Takvim yükleniyor…
        </p>
      )}
    </section>
  );
}
