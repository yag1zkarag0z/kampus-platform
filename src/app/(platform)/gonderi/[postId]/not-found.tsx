import Link from "next/link";

export default function PostNotFound() {
  return (
    <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#f8f4ed]/62 px-5 py-16 text-center dark:bg-[#141619] md:min-h-svh">
      <div className="max-w-md">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
          Gönderi bulunamadı
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
          Bu konu artık burada değil.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/60">
          Gönderi kaldırılmış veya bağlantı değişmiş olabilir.
        </p>
        <Link
          href="/akis"
          className="mt-7 inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] dark:focus-visible:ring-[#c7896d]/30"
        >
          Akışa dön
        </Link>
      </div>
    </section>
  );
}
