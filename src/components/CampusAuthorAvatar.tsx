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
  "border-[#7d3c2d]/18 bg-[#ead8cf] text-[#5a1f32] dark:border-[#d09272]/20 dark:bg-[#432a2d] dark:text-[#f0c5b1]",
  "border-[#395943]/18 bg-[#d9e3d8] text-[#234333] dark:border-[#8fba9b]/18 dark:bg-[#24382e] dark:text-[#b5d8bd]",
  "border-[#3f4965]/18 bg-[#dce0ea] text-[#303a58] dark:border-[#9aa8d3]/18 dark:bg-[#293044] dark:text-[#c4cce8]",
  "border-[#6a512d]/18 bg-[#e8dfc9] text-[#5b421f] dark:border-[#c7a96d]/18 dark:bg-[#3d3425] dark:text-[#e3cf9c]",
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
  isAnonymous: isAnonymousProp,
  size = "md",
  className = "",
}: {
  author: string;
  authorId?: string;
  isAnonymous?: boolean;
  size?: AvatarSize;
  className?: string;
}) {
  const { profile } = useCampusAccount();
  const isAnonymous = isAnonymousCampusAuthor({
    author,
    authorId,
    isAnonymous: isAnonymousProp,
  });
  const isLocalAccount =
    !isAnonymous &&
    (authorId === LOCAL_ACCOUNT_OWNER_ID || author === "@sen");
  const avatarDataUrl = isLocalAccount ? profile.avatarDataUrl : undefined;
  const fallbackSource = isLocalAccount ? profile.displayName : author;
  const toneClassName = isAnonymous
    ? "border-[#1c2821]/12 bg-[#e5e0d8] text-[#58635c] dark:border-white/11 dark:bg-[#25282c] dark:text-[#aeb4af]"
    : getAvatarTone(authorId ?? fallbackSource);

  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-black tracking-[-0.04em] shadow-[0_5px_16px_rgba(28,40,33,0.07)] dark:shadow-[0_5px_16px_rgba(0,0,0,0.18)] ${sizeClassNames[size]} ${toneClassName} ${className}`}
    >
      {avatarDataUrl ? (
        <Image
          src={avatarDataUrl}
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
