import Link from "next/link";
import PlatformRouteState from "@/components/PlatformRouteState";

export default function PostNotFound() {
  return (
    <PlatformRouteState
      eyebrow="Gönderi bulunamadı"
      title="Bu konu artık burada değil."
      description="Gönderi kaldırılmış veya bağlantısı değişmiş olabilir."
      actions={
        <Link
          href="/akis"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#5a1f32] px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#c7896d] dark:text-[#111315] dark:hover:bg-[#d99b7f] dark:focus-visible:ring-[#c7896d]/35"
        >
          Akışa dön
        </Link>
      }
    />
  );
}
