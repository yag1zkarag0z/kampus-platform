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

  // Öneriler listesindeki düz liste dilinden ayrılıyor: takvim zamana
  // duyarlı olduğu için sağ sütunda ayrı bir kart olarak öne çıkar.
  return (
    <section
      aria-labelledby="campus-calendar-title"
      className={`rounded-2xl border border-white/10 bg-white/2.5 p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="campus-calendar-title"
          className="text-lg font-black tracking-[-0.035em]"
        >
          Kampüs takvimi
        </h2>
        {events.length > 0 && (
          <Link
            href="/takvim"
            className={`shrink-0 text-sm font-bold text-brand transition-colors hover:text-brand-hover ${calendarFocusRing}`}
          >
            Tümünü gör
          </Link>
        )}
      </div>

      {events.length > 0 ? (
        <ol className="mt-3 flex flex-col divide-y divide-white/7">
          {events.map((event) => {
            const badge = formatEventBadge(event);
            const timing = getEventTiming(event);
            const style = calendarCategoryStyles[event.category];
            const isUrgent =
              timing.state === "today" || timing.state === "ongoing";

            return (
              <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href="/takvim"
                  className={`group relative -mx-2 flex items-start gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-white/5 ${calendarFocusRing}`}
                >
                  {isUrgent && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-0.5 bg-brand"
                    />
                  )}
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/5 text-center">
                    <span className="block text-sm font-black leading-none">
                      {badge.day}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-brand">
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
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm leading-6 text-white/50">
          Takvim yükleniyor…
        </p>
      )}
    </section>
  );
}
