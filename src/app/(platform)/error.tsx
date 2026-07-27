"use client";

import { useEffect } from "react";
import Link from "next/link";
import PlatformRouteState from "@/components/PlatformRouteState";

type PlatformErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function PlatformError({
  error,
  unstable_retry,
}: PlatformErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PlatformRouteState
      eyebrow="Bir şey ters gitti"
      title="Bu sayfa yüklenemedi."
      description="Bağlantını kontrol edip yeniden deneyebilirsin. Sorun devam ederse akışa dön."
      actions={
        <>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#5a1f32] px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#c7896d] dark:text-[#111315] dark:hover:bg-[#d99b7f] dark:focus-visible:ring-[#c7896d]/35"
          >
            Yeniden dene
          </button>
          <Link
            href="/akis"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#1c2821]/14 bg-white/38 px-5 text-sm font-bold outline-none transition-colors hover:bg-white/65 focus-visible:ring-3 focus-visible:ring-[#5a1f32]/20 dark:border-white/12 dark:bg-white/5 dark:hover:bg-white/9 dark:focus-visible:ring-[#c7896d]/30"
          >
            Akışa dön
          </Link>
        </>
      }
    />
  );
}
