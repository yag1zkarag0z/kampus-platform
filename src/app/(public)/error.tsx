"use client";

import Link from "next/link";
import { useEffect } from "react";

import PlatformRouteState from "@/components/PlatformRouteState";

export default function PublicError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PlatformRouteState
      fullPage
      eyebrow="Bir şey ters gitti"
      title="Sayfa şu anda açılamıyor."
      description="Kısa süre sonra yeniden deneyebilir veya ana sayfaya dönebilirsin."
      actions={
        <>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40"
          >
            Yeniden dene
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-bold text-white outline-none transition-colors hover:border-brand/35 hover:bg-brand/8 focus-visible:ring-3 focus-visible:ring-white/35"
          >
            Ana sayfaya dön
          </Link>
        </>
      }
    />
  );
}
