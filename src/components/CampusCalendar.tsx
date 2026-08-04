"use client";

import { useEffect, useMemo, useState } from "react";

import CampusAudienceTags from "@/components/CampusAudienceTags";
import {
  calendarCategoryStyles,
  calendarFocusRing,
  calendarHeaderSurface,
  calendarTile,
} from "@/components/CampusCalendarStyles";
import {
  ACADEMIC_YEAR_LABEL,
  academicAudienceLabels,
  academicCalendar,
  academicTermLabels,
  filterByAudience,
  formatCalendarUpdatedAt,
  formatEventBadge,
  formatEventDate,
  formatEventTiming,
  getEventTiming,
  getEventsByTerm,
  getUpcomingEvents,
  type AcademicAudience,
  type AcademicEvent,
  type EventTiming,
} from "@/data/academicCalendar";

type AudienceFilter = AcademicAudience | "all";

const audienceFilters: { id: AudienceFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "hazirlik", label: academicAudienceLabels.hazirlik },
  { id: "onlisans_lisans", label: academicAudienceLabels.onlisans_lisans },
  { id: "lisansustu", label: academicAudienceLabels.lisansustu },
];

export default function CampusCalendar() {
  const [audience, setAudience] = useState<AudienceFilter>("all");
  // Gün hesapları istemcide yapılır; sunucu render'ında "kaç gün kaldı"
  // bilgisi üretilirse hydration uyuşmazlığı oluşur.
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsReady(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const upcoming = useMemo(
    () => (isReady ? getUpcomingEvents(audience, 4) : []),
    [audience, isReady],
  );
  const groups = useMemo(
    () =>
      getEventsByTerm(audience).filter((group) => group.events.length > 0),
    [audience],
  );

  return (
    <section
      aria-labelledby="academic-calendar-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 overflow-x-hidden bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className={`sticky top-0 z-30 border-b border-white/12 ${calendarHeaderSurface}`}>
        <div className="px-4 py-4 sm:px-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#ff7a45]">
            Akademik yıl {ACADEMIC_YEAR_LABEL}
          </p>
          <h1
            id="academic-calendar-title"
            className="mt-0.5 text-xl font-black tracking-[-0.04em] sm:text-2xl"
          >
            Kampüs takvimi
          </h1>
        </div>

        <div
          role="group"
          aria-label="Öğrenci grubuna göre filtrele"
          className="flex snap-x gap-1 overflow-x-auto px-3 pb-3 sm:px-5"
        >
          {audienceFilters.map((filter) => {
            const isActive = audience === filter.id;
            const total = filterByAudience(
              academicCalendar,
              filter.id,
            ).length;

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setAudience(filter.id)}
                className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold whitespace-nowrap transition-colors sm:text-xs ${calendarFocusRing} ${
                  isActive
                    ? "bg-white text-[#12100e]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {filter.label}
                <span
                  className={`text-[10px] ${
                    isActive ? "text-[#12100e]/55" : "text-white/40"
                  }`}
                >
                  {total}
                </span>
              </button>
            );
          })}
        </div>

        <p className="border-t border-white/8 px-4 py-2 text-[11px] leading-4 text-white/55 sm:px-6">
          Her tarih her öğrenciyi bağlamaz. Satırların yanındaki etiketler o
          tarihin hangi grup için geçerli olduğunu gösterir.
        </p>
      </header>

      {upcoming.length > 0 && (
        <section
          aria-labelledby="calendar-upcoming-title"
          className="border-b border-white/9 px-3 py-4 sm:px-5 lg:px-6"
        >
          <h2
            id="calendar-upcoming-title"
            className="px-1 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-white/55"
          >
            Sırada ne var
          </h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((event) => (
              <li key={event.id}>
                <UpcomingCard event={event} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {groups.map((group) => (
        <section
          key={group.term}
          aria-labelledby={`calendar-term-${group.term}`}
          className="border-b border-white/9 last:border-b-0"
        >
          <h2
            id={`calendar-term-${group.term}`}
            className={`sticky top-[8.5rem] z-20 border-b border-white/8 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#ff7a45] sm:px-6 md:top-[7.5rem] ${calendarHeaderSurface}`}
          >
            {academicTermLabels[group.term]}
          </h2>

          <ol className="px-3 py-2 sm:px-5 lg:px-6 2xl:grid 2xl:grid-cols-2 2xl:gap-x-4">
            {group.events.map((event) => (
              <li
                key={event.id}
                className="border-b border-white/8 last:border-b-0 2xl:last:border-b"
              >
                <CalendarRow event={event} isReady={isReady} />
              </li>
            ))}
          </ol>
        </section>
      ))}

      <footer className="px-4 py-6 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">
          Son güncelleme · {formatCalendarUpdatedAt()}
        </p>
        <p className="mt-2 text-[11px] leading-5 text-white/50">
          Tarihler Yaşar Üniversitesi {ACADEMIC_YEAR_LABEL} akademik
          takviminden aktarılmıştır. KAMPÜS bağımsız bir öğrenci projesidir;
          bağlayıcı kaynak üniversitenin yayımladığı resmî takvimdir.
        </p>
      </footer>
    </section>
  );
}

function TimingBadge({ timing }: { timing: EventTiming }) {
  const tone =
    timing.state === "today" || timing.state === "ongoing"
      ? "border-[#ff7a45]/40 bg-[#ff7a45]/12 text-[#ffb694]"
      : timing.state === "past"
        ? "border-white/12 bg-white/4 text-white/45"
        : "border-white/14 bg-white/6 text-white/70";

  return (
    <span
      className={`inline-flex items-center border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${tone}`}
    >
      {formatEventTiming(timing)}
    </span>
  );
}

function UpcomingCard({ event }: { event: AcademicEvent }) {
  const badge = formatEventBadge(event);
  const style = calendarCategoryStyles[event.category];
  const timing = getEventTiming(event);

  return (
    <article className={`flex h-full min-w-0 flex-col p-3.5 transition-colors hover:border-[#ff7a45]/30 ${calendarTile}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center border border-white/12 bg-white/6 text-center">
          <span className="block text-base font-black leading-none text-white">
            {badge.day}
          </span>
          <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-[#ff7a45]">
            {badge.month}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-5 tracking-[-0.015em] text-white">
            {event.title}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${style.badge}`}
            >
              {style.label}
            </span>
            <TimingBadge timing={timing} />
          </p>
        </div>
      </div>

      <CampusAudienceTags
        audiences={event.audiences}
        className="mt-3 border-t border-white/8 pt-2.5"
      />
    </article>
  );
}

function CalendarRow({
  event,
  isReady,
}: {
  event: AcademicEvent;
  isReady: boolean;
}) {
  const style = calendarCategoryStyles[event.category];
  const timing = isReady ? getEventTiming(event) : null;
  const isPast = timing?.state === "past";
  const isActive =
    timing?.state === "today" || timing?.state === "ongoing";

  return (
    <div
      className={`group relative flex min-w-0 items-start gap-3 py-4 pl-3 transition-colors sm:gap-4 ${
        isPast ? "opacity-45" : "hover:bg-white/[0.03]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-0 w-0.5 ${
          isActive ? "bg-[#ff7a45]" : "bg-transparent"
        }`}
      />
      <span
        aria-hidden="true"
        className={`mt-2 size-2 shrink-0 rotate-45 ${style.dot}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-5 tracking-[-0.015em] break-words text-white sm:text-[15px] sm:leading-6">
          {event.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${style.badge}`}
          >
            {style.label}
          </span>
          {timing && <TimingBadge timing={timing} />}
        </div>

        {/* Mobilde sağ sütun yok; kritik bilgi burada kalır. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:hidden">
          <p className="text-xs font-bold whitespace-nowrap text-white/80">
            {formatEventDate(event)}
          </p>
          <CampusAudienceTags audiences={event.audiences} />
        </div>

        {event.note && (
          <p className="mt-2 border-l-2 border-white/12 pl-2.5 text-[11px] leading-4 text-white/55">
            {event.note}
          </p>
        )}
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1.5 pr-3 lg:flex">
        <p className="text-right text-xs font-bold leading-4 whitespace-nowrap text-white/85">
          {formatEventDate(event)}
        </p>
        <CampusAudienceTags
          audiences={event.audiences}
          className="justify-end"
        />
      </div>
    </div>
  );
}
