"use client";

import type { ReactNode } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusLogo from "@/components/CampusLogo";

/**
 * Bütün profillerin ortak üst bölümü.
 *
 * Kendi profilin ve başkasının profili ayrı bileşenler (biri oturumdan, diğeri
 * herkese açık endpoint'ten besleniyor) ama düzen tek yerde tanımlı olmalı:
 * kopyalandığında avatar boyutu, boşluk ve tipografi farkları sürekli kaçıyordu.
 *
 * Değişen tek şey sağdaki eylemler ve addan sonraki rozetler.
 */
export default function CampusProfileHero({
  coverIdPrefix,
  author,
  authorId,
  avatarUrl,
  displayName,
  username,
  bio,
  bioFallback,
  department,
  joinedLabel,
  badges,
  actions,
  stats,
  children,
}: {
  coverIdPrefix: string;
  author: string;
  authorId?: string;
  avatarUrl?: string | null;
  displayName: string;
  username: string;
  bio?: string;
  /** Biyografi boşken gösterilecek yumuşak metin; verilmezse alan gizlenir. */
  bioFallback?: string;
  department?: string | null;
  joinedLabel: string;
  badges?: ReactNode;
  actions?: ReactNode;
  stats?: { label: string; value: number }[];
  /** Takip sayaçları gibi ada bağlı ek içerik. */
  children?: ReactNode;
}) {
  const trimmedBio = bio?.trim();

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Kapak alanı: banner yüklemesi yok, kimliği KAMPÜS logosu taşıyor. */}
      <div
        aria-hidden="true"
        className="grid h-32 w-full place-items-center overflow-hidden bg-surface sm:h-48"
      >
        <CampusLogo
          idPrefix={coverIdPrefix}
          wordmarkClassName="text-3xl opacity-40 sm:text-4xl"
        />
      </div>

      <div className="border-b border-white/12 px-4 pb-6 sm:px-6">
        {/* Avatar kapağa taşar, eylemler sağ üstte durur. */}
        <div className="flex items-start justify-between gap-3">
          <span className="-mt-14 inline-flex shrink-0 rounded-full ring-4 ring-canvas sm:-mt-20">
            <CampusAuthorAvatar
              author={author}
              authorId={authorId}
              avatarUrl={avatarUrl}
              size="md"
              className="size-24 text-2xl sm:size-32 sm:text-3xl"
            />
          </span>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-3">
              {actions}
            </div>
          )}
        </div>

        {/* Ad, kullanıcı adı ve künye avatarın altında dikey akar. */}
        <div className="mt-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-2xl font-black tracking-[-0.045em] sm:text-3xl">
              {displayName}
            </h2>
            {badges}
          </div>
          <p className="mt-0.5 break-all text-sm font-bold text-white/55">
            @{username}
          </p>

          {trimmedBio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-[15px] leading-6 text-white/78 [overflow-wrap:anywhere]">
              {trimmedBio}
            </p>
          ) : bioFallback ? (
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-white/55">
              {bioFallback}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
            {department && (
              <span className="inline-flex items-center gap-1.5">
                <DepartmentIcon />
                {department}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon />
              {joinedLabel}
            </span>
          </div>

          {children}
        </div>

        {stats && stats.length > 0 && (
          <dl className="mt-5 grid grid-cols-3 border-y border-white/12">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 border-r border-white/8 px-2 py-4 text-center last:border-r-0 sm:py-5"
              >
                <dd className="truncate text-lg font-black tracking-[-0.03em] sm:text-xl">
                  {stat.value.toLocaleString("tr-TR")}
                </dd>
                <dt className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/55 sm:text-[11px]">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] shrink-0"
    >
      <rect x="3" y="4.8" width="14" height="12.2" rx="1.6" />
      <path d="M3 8.6h14M6.8 3v3.2M13.2 3v3.2" />
    </svg>
  );
}

function DepartmentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] shrink-0"
    >
      <path d="M10 3.2 18 7l-8 3.8L2 7l8-3.8Z" />
      <path d="M5.4 9.1v4.2c0 .9 2.1 2.1 4.6 2.1s4.6-1.2 4.6-2.1V9.1" />
    </svg>
  );
}
