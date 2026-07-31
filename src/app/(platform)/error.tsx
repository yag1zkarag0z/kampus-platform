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
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#12100e] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40"
          >
            Yeniden dene
          </button>
          <Link
            href="/akis"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-bold text-white outline-none transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 focus-visible:ring-3 focus-visible:ring-white/35"
          >
            Akışa dön
          </Link>
        </>
      }
    />
  );
}
