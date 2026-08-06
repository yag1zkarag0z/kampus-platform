"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CampusAudienceTags from "@/components/CampusAudienceTags";
import { calendarFocusRing } from "@/components/CampusCalendarStyles";
import {
  formatEventBadge,
  formatEventTiming,
  getEventTiming,
  getUpcomingEvents,
  type AcademicEvent,
} from "@/data/academicCalendar";

/**
 * Mobil için takvim giriş noktası.
 *
 * Alt menüde beş slot dolu olduğu için takvime doğrudan bağlantı yok; en
 * yakın iki tarih burada gösterilip tam takvime yönlendiriliyor.
 */
export default function CampusCalendarStrip({
  className = "",
}: {
  className?: string;
}) {
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  // Varsayılan açık: kullanıcı Keşfet'e girer girmez takvim görünsün.
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setEvents(getUpcomingEvents("all", 2));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (events.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="calendar-strip-title"
      className={`border-b border-white/8 px-4 py-2 ${className}`}
    >
      <h2 id="calendar-strip-title" className="sr-only">
        Kampüs takvimi
      </h2>

      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="calendar-strip-list"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center gap-2.5 text-left ${calendarFocusRing}`}
      >
        <CalendarIcon />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#ff7a45]">
          Kampüs takvimi
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-white/55">
          {isOpen ? "Gizle" : `${events.length} yaklaşan`}
          <ChevronIcon isOpen={isOpen} />
        </span>
      </button>

      <ol
        id="calendar-strip-list"
        hidden={!isOpen}
        className="mt-1 grid gap-2 pb-2"
      >
        {events.map((event) => {
          const badge = formatEventBadge(event);

          return (
            <li key={event.id}>
              <Link
                href="/takvim"
                className={`flex items-start gap-2.5 border border-white/10 bg-white/[0.03] p-2.5 transition-colors hover:border-[#ff7a45]/30 ${calendarFocusRing}`}
              >
                <span className="grid size-9 shrink-0 place-items-center border border-white/12 bg-white/6 text-center">
                  <span className="block text-xs font-black leading-none">
                    {badge.day}
                  </span>
                  <span className="mt-px block font-mono text-[8px] font-bold tracking-[0.1em] text-[#ff7a45]">
                    {badge.month}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-4">
                    {event.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/55">
                    {formatEventTiming(getEventTiming(event))}
                  </span>
                  <CampusAudienceTags
                    audiences={event.audiences}
                    size="sm"
                    className="mt-1.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {isOpen && (
        <Link
          href="/takvim"
          className={`block pb-1 text-[11px] font-bold text-[#ff7a45] ${calendarFocusRing}`}
        >
          Tüm akademik takvim
        </Link>
      )}
    </section>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="size-4 shrink-0 text-[#ff7a45]"
    >
      <rect x="3.8" y="5.2" width="16.4" height="15" rx="2" />
      <path d="M3.8 9.8h16.4M8.4 3.5v3.4M15.6 3.5v3.4" />
    </svg>
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
      className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
    >
      <path d="m5.5 8 4.5 4.5L14.5 8" />
    </svg>
  );
}
