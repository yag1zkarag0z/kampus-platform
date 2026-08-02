"use client";

import Image from "next/image";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";

type AvatarSize = "sm" | "md";

const sizeClassNames: Record<AvatarSize, string> = {
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
};

const imageSizes: Record<AvatarSize, string> = {
  sm: "32px",
  md: "40px",
};

const avatarToneClassNames = [
  "border-[#e0a083]/20 bg-[#432a2d] text-[#f0c5b1]",
  "border-[#8fba9b]/18 bg-[#24382e] text-[#b5d8bd]",
  "border-[#9aa8d3]/18 bg-[#293044] text-[#c4cce8]",
  "border-[#c7a96d]/18 bg-[#3d3425] text-[#e3cf9c]",
] as const;

function getInitials(value: string) {
  const normalizedValue = value.replace(/^@/, "").trim();
  const parts = normalizedValue.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("tr-TR");
  }

  return normalizedValue.slice(0, 2).toLocaleUpperCase("tr-TR") || "K";
}

function getAvatarTone(value: string) {
  const hash = Array.from(value).reduce((currentHash, character) => {
    const nextHash = currentHash ^ character.codePointAt(0)!;
    return Math.imul(nextHash, 16_777_619);
  }, 2_166_136_261);

  return avatarToneClassNames[(hash >>> 0) % avatarToneClassNames.length];
}

export default function CampusAuthorAvatar({
  author,
  authorId,
  avatarUrl: avatarUrlProp,
  isAnonymous: isAnonymousProp,
  size = "md",
  className = "",
}: {
  author: string;
  authorId?: string;
  avatarUrl?: string | null;
  isAnonymous?: boolean;
  size?: AvatarSize;
  className?: string;
}) {
  const { profile, sessionMode } = useCampusAccount();
  const isAnonymous = isAnonymousCampusAuthor({
    author,
    authorId,
    isAnonymous: isAnonymousProp,
  });
  const isLocalAccount =
    sessionMode === "member" &&
    !isAnonymous &&
    (authorId === LOCAL_ACCOUNT_OWNER_ID || author === "@sen");
  const avatarUrl =
    avatarUrlProp ?? (isLocalAccount ? profile.avatarUrl : null);
  const fallbackSource = isLocalAccount ? profile.displayName : author;
  const toneClassName = isAnonymous
    ? "border-white/11 bg-[#25282c] text-white/55"
    : getAvatarTone(authorId ?? fallbackSource);

  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-black tracking-[-0.04em] shadow-[0_5px_16px_rgba(0,0,0,0.18)] ${sizeClassNames[size]} ${toneClassName} ${className}`}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          fill
          sizes={imageSizes[size]}
          unoptimized
          className="object-cover"
        />
      ) : isAnonymous ? (
        <span className="font-serif text-base font-black italic">?</span>
      ) : (
        <span>{getInitials(fallbackSource)}</span>
      )}
    </span>
  );
}
