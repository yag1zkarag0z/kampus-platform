"use client";

import Image from "next/image";

import type { CampusPostImage as CampusPostImageData } from "@/data/campusPosts";

export default function CampusPostImage({
  image,
  variant = "card",
}: {
  image: CampusPostImageData;
  variant?: "compact" | "card" | "detail";
}) {
  const heightClassName =
    variant === "detail"
      ? "max-h-[42rem]"
      : variant === "compact"
        ? "max-h-64"
        : "max-h-[32rem]";

  return (
    <div className="mt-4 overflow-hidden border border-[#1c2821]/12 bg-[#ece7df] dark:border-white/10 dark:bg-[#101214]">
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={
          variant === "compact"
            ? "(max-width: 768px) 100vw, 560px"
            : "(max-width: 768px) 100vw, 900px"
        }
        unoptimized
        className={`h-auto w-full object-contain ${heightClassName}`}
      />
    </div>
  );
}
