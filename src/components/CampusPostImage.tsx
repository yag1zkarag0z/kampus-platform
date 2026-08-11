"use client";

import Image from "next/image";
import { useId, useState } from "react";

import CampusLogo from "@/components/CampusLogo";
import type { CampusPostImage as CampusPostImageData } from "@/data/campusPosts";

export default function CampusPostImage({
  image,
  variant = "card",
  loading = "lazy",
}: {
  image: CampusPostImageData;
  variant?: "compact" | "card" | "detail";
  loading?: "eager" | "lazy";
}) {
  const fallbackId = useId().replaceAll(":", "");
  const [failedImageSource, setFailedImageSource] = useState<string | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasImageError = failedImageSource === image.src;
  const heightClassName =
    variant === "detail"
      ? "max-h-[42rem]"
      : variant === "compact"
        ? "max-h-64"
        : "max-h-[32rem]";

  return (
    <div className="relative mt-4 overflow-hidden border border-white/12 bg-surface-raised">
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
        <>
          {!isLoaded && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-white/6 motion-reduce:animate-none"
            />
          )}
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading={loading}
            unoptimized={image.src.startsWith("/v1/media/")}
            sizes={
              variant === "compact"
                ? "(max-width: 768px) 100vw, 560px"
                : "(max-width: 768px) 100vw, 900px"
            }
            onLoad={() => setIsLoaded(true)}
            onError={() => setFailedImageSource(image.src)}
            className={`h-auto w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${heightClassName} ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}
    </div>
  );
}
