"use client";

import Image from "next/image";
import { useId, useState } from "react";

import CampusLogo from "@/components/CampusLogo";
import type { CampusPostImage as CampusPostImageData } from "@/data/campusPosts";

export default function CampusPostImage({
  image,
  variant = "card",
}: {
  image: CampusPostImageData;
  variant?: "compact" | "card" | "detail";
}) {
  const fallbackId = useId().replaceAll(":", "");
  const [failedImageSource, setFailedImageSource] = useState<string | null>(
    null,
  );
  const hasImageError = failedImageSource === image.src;
  const heightClassName =
    variant === "detail"
      ? "max-h-[42rem]"
      : variant === "compact"
        ? "max-h-64"
        : "max-h-[32rem]";

  return (
    <div className="mt-4 overflow-hidden border border-white/12 bg-[#141720]">
      {hasImageError ? (
        <div
          role="img"
          aria-label={`${image.alt}. Görsel yüklenemedi.`}
          className="grid min-h-48 place-items-center px-5 py-10 text-center sm:min-h-56"
        >
          <div>
            <CampusLogo
              variant="mark"
              idPrefix={`post-image-fallback-${variant}-${fallbackId}`}
              markClassName="mx-auto h-10 w-9 opacity-55"
            />
            <p className="mt-4 text-sm font-black">Görsel yüklenemedi</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Diğer içerikleri görüntülemeye devam edebilirsin.
            </p>
          </div>
        </div>
      ) : (
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          unoptimized={image.src.startsWith("/v1/media/")}
          sizes={
            variant === "compact"
              ? "(max-width: 768px) 100vw, 560px"
              : "(max-width: 768px) 100vw, 900px"
          }
          onError={() => setFailedImageSource(image.src)}
          className={`h-auto w-full object-cover ${heightClassName}`}
        />
      )}
    </div>
  );
}
