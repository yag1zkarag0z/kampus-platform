"use client";

import { useEffect, useMemo, useState } from "react";

import CampusAudienceTags from "@/components/CampusAudienceTags";
import CampusCalendarMonthGrid, {
  startOfMonth,
} from "@/components/CampusCalendarMonthGrid";
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
  getEventsOnDate,
  getUpcomingEvents,
  startOfDay,
  type AcademicAudience,
  type AcademicEvent,
  type EventTiming,
} from "@/data/academicCalendar";

const selectedDayFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

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
  // Masaüstü ay grid'i için de aynı sebeple: "bugün" sunucu ve istemcide
  // farklı gün olabilir, o yüzden ilk render'da null kalır.
  const [displayedMonth, setDisplayedMonth] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsReady(true);
        setDisplayedMonth(startOfMonth(new Date()));
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
  const audienceEvents = useMemo(
    () => filterByAudience(academicCalendar, audience),
    [audience],
  );
  const selectedDateEvents = useMemo(
    () =>
      selectedDate ? getEventsOnDate(audienceEvents, selectedDate) : [],
    [audienceEvents, selectedDate],
  );

  const jumpToToday = () => {
    const today = startOfDay(new Date());
    setDisplayedMonth(startOfMonth(today));
    setSelectedDate(today);
  };

  return (
    <section
      aria-labelledby="academic-calendar-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 overflow-x-hidden bg-canvas text-white md:min-h-svh"
    >
      <header className={`sticky top-0 z-30 border-b border-white/12 ${calendarHeaderSurface}`}>
        <div className="px-4 py-4 sm:px-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-brand">
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
                    ? "bg-white text-[#101012]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {filter.label}
                <span
                  className={`text-[10px] ${
                    isActive ? "text-[#101012]/55" : "text-white/40"
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

      <section
        aria-label="Sırada ne var ve takvim"
        className="border-b border-white/9 px-3 py-4 sm:px-5 lg:px-6"
      >
        {/* Mobilde: mevcut kronolojik kart listesi, değişmedi. */}
        {upcoming.length > 0 && (
          <div className="md:hidden">
            <h2 className="px-1 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-white/55">
              Sırada ne var
            </h2>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {upcoming.map((event) => (
                <li key={event.id}>
                  <UpcomingCard event={event} />
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Masaüstünde: mini ay grid'i + seçili günün/yaklaşanların ajandası. */}
        <div className="hidden md:flex md:items-start md:gap-4">
          {displayedMonth ? (
            <CampusCalendarMonthGrid
              month={displayedMonth}
              onMonthChange={setDisplayedMonth}
              onJumpToToday={jumpToToday}
              events={audienceEvents}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              className="w-64 shrink-0"
            />
          ) : (
            <div
              className={`w-64 shrink-0 p-3.5 text-sm text-white/50 ${calendarTile}`}
            >
              Takvim yükleniyor…
            </div>
          )}

          <div className="min-w-0 flex-1">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-sm font-black tracking-[-0.02em] capitalize">
                    {selectedDayFormatter.format(selectedDate)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className={`shrink-0 text-[11px] font-bold text-white/50 transition-colors hover:text-white ${calendarFocusRing}`}
                  >
                    Temizle
                  </button>
                </div>
                {selectedDateEvents.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {selectedDateEvents.slice(0, 2).map((event) => (
                      <li key={event.id}>
                        <UpcomingCard event={event} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 px-1 text-sm leading-6 text-white/50">
                    Bu tarihte etkinlik yok.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="px-1 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-white/55">
                  Sırada ne var
                </h2>
                {upcoming.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {upcoming.slice(0, 2).map((event) => (
                      <li key={event.id}>
                        <UpcomingCard event={event} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 px-1 text-sm leading-6 text-white/50">
                    Yaklaşan etkinlik yok.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section
          key={group.term}
          aria-labelledby={`calendar-term-${group.term}`}
          className="border-b border-white/9 last:border-b-0"
        >
          <h2
            id={`calendar-term-${group.term}`}
            className={`sticky top-[8.5rem] z-20 border-b border-white/8 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-brand sm:px-6 md:top-[7.5rem] ${calendarHeaderSurface}`}
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
      ? "border-brand/40 bg-brand/12 text-[#ffa082]"
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
    <article className={`flex h-full min-w-0 flex-col p-3.5 transition-colors hover:border-brand/30 ${calendarTile}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center border border-white/12 bg-white/6 text-center">
          <span className="block text-base font-black leading-none text-white">
            {badge.day}
          </span>
          <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-brand">
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
          isActive ? "bg-brand" : "bg-transparent"
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
