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
      className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#151a26] to-[#10141d] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_18px_40px_-24px_rgba(0,0,0,0.9)] ${className}`}
    >
      {/* Turuncu ince şerit: takvim kampüsün kimlik rengini taşısın. */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ff7a45]/55 to-transparent" />

      <div className="px-5 pt-4 pb-3">
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
                className="border-t border-white/6 px-5 py-4 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#ff7a45]/22 bg-[#ff7a45]/10 text-center">
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
        className={`flex items-center justify-between border-t border-white/8 px-5 py-3.5 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 ${calendarFocusRing}`}
      >
        Tüm akademik takvim
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
