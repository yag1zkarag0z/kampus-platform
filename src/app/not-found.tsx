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
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#5a1f32] px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#c7896d] dark:text-[#111315] dark:hover:bg-[#d99b7f] dark:focus-visible:ring-[#c7896d]/35"
          >
            Ana sayfaya dön
          </Link>
          <Link
            href="/akis"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#1c2821]/14 bg-white/38 px-5 text-sm font-bold outline-none transition-colors hover:bg-white/65 focus-visible:ring-3 focus-visible:ring-[#5a1f32]/20 dark:border-white/12 dark:bg-white/5 dark:hover:bg-white/9 dark:focus-visible:ring-[#c7896d]/30"
          >
            Akışı aç
          </Link>
        </>
      }
    />
  );
}
