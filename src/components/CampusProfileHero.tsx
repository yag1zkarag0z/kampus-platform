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
        className="grid h-[120px] w-full place-items-center overflow-hidden bg-surface sm:h-[192px]"
      >
        <CampusLogo
          idPrefix={coverIdPrefix}
          wordmarkClassName="text-[28px] opacity-40 sm:text-[36px]"
        />
      </div>

      <div className="border-b border-white/12 px-[16px] pb-[24px] sm:px-[24px]">
        {/* Avatar kapağa taşar, eylemler sağ üstte durur. */}
        <div className="flex items-start justify-between gap-[12px]">
          <span className="-mt-[48px] inline-flex shrink-0 rounded-full ring-4 ring-canvas sm:-mt-[80px]">
            <CampusAuthorAvatar
              author={author}
              authorId={authorId}
              avatarUrl={avatarUrl}
              size="md"
              className="size-[88px] text-[22px] sm:size-[128px] sm:text-[30px]"
            />
          </span>

          {actions && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-[8px] pt-[12px] [&>a]:min-h-[44px] [&>a]:px-[14px] [&>a]:text-[14px] sm:[&>a]:px-[20px]">
              {actions}
            </div>
          )}
        </div>

        {/* Ad, kullanıcı adı ve künye avatarın altında dikey akar. */}
        <div className="mt-[12px] min-w-0">
          <div className="flex flex-wrap items-center gap-[8px]">
            <h2 className="break-words text-[24px] font-black tracking-[-0.045em] sm:text-[30px]">
              {displayName}
            </h2>
            {badges}
          </div>
          <p className="mt-[2px] break-all text-[14px] font-bold text-white/55">
            @{username}
          </p>

          {trimmedBio ? (
            <p className="mt-[12px] max-w-2xl whitespace-pre-wrap break-words text-[15px] leading-[24px] text-white/78 [overflow-wrap:anywhere]">
              {trimmedBio}
            </p>
          ) : bioFallback ? (
            <p className="mt-[12px] max-w-2xl text-[15px] leading-[24px] text-white/55">
              {bioFallback}
            </p>
          ) : null}

          <div className="mt-[12px] flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[14px] text-white/55">
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
          <dl className="mt-[20px] grid grid-cols-3 border-y border-white/12">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 border-r border-white/8 px-[8px] py-[16px] text-center last:border-r-0 sm:py-[20px]"
              >
                <dd className="truncate text-[18px] font-black tracking-[-0.03em] sm:text-[20px]">
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
