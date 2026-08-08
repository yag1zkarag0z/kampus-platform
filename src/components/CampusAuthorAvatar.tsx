"use client";

import Image from "next/image";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";

type AvatarSize = "sm" | "md" | "lg";

const sizeClassNames: Record<AvatarSize, string> = {
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
};

const imageSizes: Record<AvatarSize, string> = {
  sm: "32px",
  md: "40px",
  lg: "48px",
};

const avatarToneClassNames = [
  "border-[#fb7185]/18 bg-[#27181d] text-[#fda4af]",
  "border-[#34d399]/18 bg-[#13251e] text-[#6ee7b7]",
  "border-[#60a5fa]/18 bg-[#152033] text-[#93c5fd]",
  "border-[#fbbf24]/18 bg-[#2a2112] text-[#fcd34d]",
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
    (sessionMode === "member" || sessionMode === "guest") &&
    !isAnonymous &&
    (authorId === LOCAL_ACCOUNT_OWNER_ID || author === "@sen");
  const avatarUrl =
    avatarUrlProp ?? (isLocalAccount ? profile.avatarUrl : null);
  const fallbackSource = isLocalAccount ? profile.displayName : author;
  const toneClassName = isAnonymous
    ? "border-white/10 bg-surface-hover text-white/55"
    : getAvatarTone(authorId ?? fallbackSource);

  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-black tracking-[-0.04em] ${sizeClassNames[size]} ${toneClassName} ${className}`}
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
