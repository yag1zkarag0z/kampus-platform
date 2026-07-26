import Link from "next/link";

export default function ClosingCTA() {
  return (
    <section
      aria-labelledby="closing-title"
      className="closing-cta-surface relative overflow-hidden border-b border-[#1c2821]/18 text-[#1c2821] dark:border-white/12 dark:text-[#ece8e1]"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 opacity-[0.065]"
      />

      <div className="relative mx-auto grid w-full max-w-[1360px] gap-9 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-20 lg:px-12 lg:py-24">
        <div>
          <p className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#3b2028] dark:text-[#c7896d] sm:text-xs">
            Sıra sende
          </p>
          <h2
            id="closing-title"
            className="max-w-4xl text-[clamp(2.65rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.06em]"
          >
            Kampüste konuşulanlara
            <span className="block font-serif font-normal italic dark:text-[#c7896d]">
              sen de katıl.
            </span>
          </h2>
        </div>

        <div className="lg:max-w-xs">
          <Link
            href="/kayit"
            className="group flex min-h-14 w-full items-center justify-between gap-8 rounded-xl bg-[#1c2821] px-5 font-bold text-[#fbf8f1] outline-none transition-colors hover:bg-[#5a2135] focus-visible:ring-4 focus-visible:ring-[#1c2821]/25 focus-visible:ring-offset-4 focus-visible:ring-offset-[#b8795f] dark:bg-[#c7896d] dark:text-[#121417] dark:hover:bg-[#8f8ba3] dark:focus-visible:ring-[#c7896d]/35 dark:focus-visible:ring-offset-[#211b1c] sm:w-fit lg:w-full"
          >
            Öğrenci e-postanla katıl
            <span
              aria-hidden="true"
              className="transition-transform group-hover:-translate-y-0.5"
            >
              ↑
            </span>
          </Link>
          <p className="mt-4 text-xs leading-5 text-[#1c2821]/68 dark:text-white/68">
            @stu.yasar.edu.tr uzantılı öğrenci e-postanı doğrulaman yeterli.
          </p>
        </div>
      </div>
    </section>
  );
}
