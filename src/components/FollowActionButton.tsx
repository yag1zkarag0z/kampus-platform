"use client";

import { useState } from "react";

import { campusFocusRing } from "@/components/campusButtonStyles";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-black whitespace-nowrap transition-colors";

const sizeClassNames = {
  compact: "min-h-9 min-w-23 px-3.5 text-[13px]",
  wide: "min-h-11 w-full px-4 text-sm",
} as const;

/**
 * Takip butonu tek yerde: satırda ve hover kartında aynı anda görünüyor,
 * ikisinin farklı davranması kullanıcıyı yanıltırdı.
 *
 * Takip edilen kişide butonun üzerine gelince etiket "Bırak"a döner; durum
 * göstergesiyle geri alma düğmesi aynı yeri paylaşıyor, böylece dar sağ rayda
 * ikinci bir kontrol açmaya gerek kalmıyor.
 */
export default function FollowActionButton({
  displayName,
  isFollowed,
  onToggle,
  size = "compact",
  className = "",
}: {
  displayName: string;
  isFollowed: boolean;
  onToggle: () => void;
  size?: keyof typeof sizeClassNames;
  className?: string;
}) {
  const [hasLeaveIntent, setHasLeaveIntent] = useState(false);
  const showLeaveIntent = isFollowed && hasLeaveIntent;

  const label = !isFollowed
    ? "Takip et"
    : showLeaveIntent
      ? "Bırak"
      : "Takipte";

  const toneClassName = !isFollowed
    ? "border border-white/16 bg-transparent text-white hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
    : showLeaveIntent
      ? "border border-danger/45 bg-danger/10 text-danger"
      : "border border-brand/40 bg-brand/12 text-[#ffa082]";

  return (
    <button
      type="button"
      // Görünen etiket imleçle değişiyor; erişilebilir ad her zaman gerçek
      // eylemi anlatmalı.
      aria-label={
        isFollowed
          ? `${displayName} kullanıcısını takipten çık`
          : `${displayName} kullanıcısını takip et`
      }
      onClick={onToggle}
      onPointerEnter={() => setHasLeaveIntent(true)}
      onPointerLeave={() => setHasLeaveIntent(false)}
      onFocus={() => setHasLeaveIntent(true)}
      onBlur={() => setHasLeaveIntent(false)}
      className={`${base} ${sizeClassNames[size]} ${toneClassName} ${campusFocusRing} ${className}`}
    >
      {isFollowed ? (
        showLeaveIntent ? null : (
          <CheckIcon />
        )
      ) : (
        <PersonPlusIcon />
      )}
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
    >
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function PersonPlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-3.5 shrink-0">
      <circle cx="7.5" cy="6.3" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 15.3c.4-2.8 1.9-4.2 4-4.2s3.6 1.4 4 4.2M14.8 6.8v5M12.3 9.3h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
