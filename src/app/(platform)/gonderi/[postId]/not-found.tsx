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
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#12100e] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40"
        >
          Akışa dön
        </Link>
      }
    />
  );
}
