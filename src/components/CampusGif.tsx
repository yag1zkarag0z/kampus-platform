"use client";

import Image from "next/image";

import type { CampusGif as CampusGifData } from "@/data/campusPosts";

export default function CampusGif({ gif, compact = false }: { gif: CampusGifData; compact?: boolean }) {
  return (
    <figure className={`mt-3 w-fit min-w-0 max-w-full overflow-hidden border border-white/10 bg-black/25 ${compact ? "sm:max-w-sm" : "sm:max-w-[32rem]"}`}>
      <Image
        src={gif.src}
        alt={gif.alt}
        width={gif.width}
        height={gif.height}
        sizes={compact ? "(max-width: 640px) 82vw, 384px" : "(max-width: 900px) 92vw, 576px"}
        unoptimized
        className="block h-auto max-h-[28rem] w-auto max-w-full object-contain"
      />
      <figcaption className="sr-only">GIPHY tarafından sağlanan GIF</figcaption>
    </figure>
  );
}
