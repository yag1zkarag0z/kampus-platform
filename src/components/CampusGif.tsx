"use client";

import Image from "next/image";
import { useState } from "react";

import type { CampusGif as CampusGifData } from "@/data/campusPosts";

export default function CampusGif({ gif, compact = false }: { gif: CampusGifData; compact?: boolean }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return (
      <figure
        role="img"
        aria-label={`${gif.alt}. GIF yüklenemedi.`}
        className="mt-3 grid min-h-24 w-full max-w-sm place-items-center border border-dashed border-white/12 bg-white/[0.02] px-4 py-5 text-center"
      >
        <figcaption className="text-xs font-bold text-white/55">
          GIF yüklenemedi
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`relative mt-3 w-fit min-w-0 max-w-full overflow-hidden border border-white/10 bg-black/25 ${compact ? "sm:max-w-sm" : "sm:max-w-[32rem]"}`}>
      {/* Genişlik ve yükseklik verildiği için yer baştan ayrılıyor; burada
          yalnızca inene kadar sakin bir yüzey gösteriyoruz. */}
      {!isLoaded && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-white/6 motion-reduce:animate-none"
        />
      )}
      <Image
        src={gif.src}
        alt={gif.alt}
        width={gif.width}
        height={gif.height}
        sizes={compact ? "(max-width: 640px) 82vw, 384px" : "(max-width: 900px) 92vw, 576px"}
        unoptimized
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasFailed(true)}
        className={`block h-auto max-h-[28rem] w-auto max-w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <figcaption className="sr-only">
        {gif.src.startsWith("https://media.giphy.com/")
          ? "GIPHY tarafından sağlanan GIF"
          : "KAMPÜS için hazırlanmış hareketli görsel"}
      </figcaption>
    </figure>
  );
}
