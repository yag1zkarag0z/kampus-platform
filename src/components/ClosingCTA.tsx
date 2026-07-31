import Link from "next/link";

export default function ClosingCTA() {
  return (
    <section
      aria-labelledby="closing-title"
      className="reveal-item relative overflow-hidden border-b border-white/10 bg-[#0a0d16] text-white"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 opacity-[0.065]"
      />

      <div className="relative mx-auto grid w-full max-w-[1360px] gap-9 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-20 lg:px-12 lg:py-24">
        <div className="reveal-item">
          <p className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff7a45] sm:text-xs">
            Sıra sende
          </p>
          <h2
            id="closing-title"
            className="max-w-4xl text-[clamp(2.65rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.06em]"
          >
            Kampüste konuşulanlara
            <span className="block font-serif font-normal italic text-[#ff7a45]">
              sen de katıl.
            </span>
          </h2>
        </div>

        <div className="reveal-item lg:max-w-xs">
          <Link
            href="/kayit"
            className="group flex min-h-14 w-full items-center justify-between gap-8 rounded-xl bg-white px-5 font-bold text-[#12100e] outline-none transition-colors hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0d16] sm:w-fit lg:w-full"
          >
            Öğrenci e-postanla katıl
            <span
              aria-hidden="true"
              className="transition-transform group-hover:-translate-y-0.5"
            >
              ↑
            </span>
          </Link>
          <p className="mt-4 text-sm leading-6 text-white/78">
            @stu.yasar.edu.tr uzantılı öğrenci e-postanı doğrulaman yeterli.
          </p>
        </div>
      </div>
    </section>
  );
}
