import Link from "next/link";
import PlatformRouteState from "@/components/PlatformRouteState";

export default function NotFound() {
  return (
    <PlatformRouteState
      fullPage
      eyebrow="404 · Sayfa bulunamadı"
      title="Aradığın sayfa kampüste değil."
      description="Bağlantı değişmiş, içerik kaldırılmış veya adres yanlış yazılmış olabilir."
      actions={
        <>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40"
          >
            Ana sayfaya dön
          </Link>
          <Link
            href="/akis"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 text-sm font-bold text-white outline-none transition-colors hover:border-brand/35 hover:bg-brand/8 focus-visible:ring-3 focus-visible:ring-white/35"
          >
            Akışı aç
          </Link>
        </>
      }
    />
  );
}
