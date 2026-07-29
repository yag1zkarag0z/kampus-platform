import Link from "next/link";

const steps = [
  {
    number: "01",
    label: "Öğrenci e-postası",
    title: "Yaşar e-postanı doğrula.",
    description:
      "@stu.yasar.edu.tr adresine gönderilen 6 haneli kodu gir ve hesabını aç.",
    detail: "Yalnızca Yaşar öğrencileri",
  },
  {
    number: "02",
    label: "Kampüs akışı",
    title: "Kampüste olup biteni gör.",
    description:
      "İtirafları, soruları, kayıp eşya ilanlarını ve etkinlikleri tek yerde takip et.",
    detail: "Selçuk Yaşar Kampüsü",
  },
  {
    number: "03",
    label: "Paylaşmaya başla",
    title: "İster adınla, ister anonim paylaş.",
    description:
      "İtirafını, sorunu ya da duyurunu yaz. Anonim gönderilerde adın görünmez; topluluk kuralları yine geçerlidir.",
    detail: "Adın görünmez, kurallar geçerli",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      aria-labelledby="how-it-works-title"
      className="how-it-works-surface relative overflow-x-clip border-b border-[#1c2821]/14 text-[#1c2821] dark:border-white/10 dark:text-[#ece8e1]"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto w-full max-w-[1360px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <header className="grid gap-7 border-b border-[#1c2821]/16 pb-10 dark:border-white/12 sm:pb-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-px w-9 bg-[#a83d2d] dark:bg-[#c7896d]"
              />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f3427] dark:text-[#c7896d] sm:text-xs">
                Nasıl çalışır?
              </p>
            </div>

            <h2
              id="how-it-works-title"
              className="max-w-3xl text-[clamp(2.7rem,7vw,5.8rem)] font-black leading-[0.92] tracking-[-0.06em]"
            >
              Üç adımda
              <span className="block font-serif font-normal italic text-[#a83d2d] dark:text-[#c7896d]">
                aramıza katıl.
              </span>
            </h2>
          </div>

          <p className="max-w-xl text-base leading-7 text-[#1c2821]/66 dark:text-white/66 sm:text-lg sm:leading-8 lg:justify-self-end">
            Yaşar öğrenci e-postanı doğrula, profilini oluştur ve kampüste
            konuşulanları görmeye başla.
          </p>
        </header>

        <ol className="grid md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.number}
              className={`group relative flex h-full flex-col border-b border-[#1c2821]/14 py-7 dark:border-white/12 sm:py-11 md:border-b-0 md:px-5 md:py-12 lg:px-8 lg:py-14 ${
                index === 0
                  ? "md:pl-0"
                  : "md:border-l md:border-[#1c2821]/14 md:dark:border-white/12"
              } ${index === steps.length - 1 ? "md:pr-0" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[11px] font-bold text-[#963629] dark:text-[#c7896d]">
                  {step.number}
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#1c2821]/62 dark:text-white/60">
                  {step.label}
                </span>
              </div>

              <h3 className="mt-8 max-w-sm text-2xl font-black leading-[1.05] tracking-[-0.045em] sm:text-[1.75rem] md:min-h-[5.75rem]">
                {step.title}
              </h3>

              <p className="mt-5 hidden max-w-sm text-sm leading-6 text-[#1c2821]/62 dark:text-white/62 sm:block md:mb-9">
                {step.description}
              </p>

              <div className="mt-9 flex items-center gap-3 border-t border-[#1c2821]/12 pt-4 font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#1c2821]/62 dark:border-white/10 dark:text-white/60 md:mt-auto">
                <span
                  aria-hidden="true"
                  className="size-1.5 rotate-45 bg-[#b5412f] transition-transform duration-300 group-hover:rotate-[135deg] dark:bg-[#c7896d]"
                />
                {step.detail}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-4 border-t border-[#1c2821]/16 pt-6 dark:border-white/12 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#1c2821]/62 dark:text-white/60">
            E-postanı doğrula → Profilini oluştur → Akışa katıl
          </p>
          <Link
            href="/kayit"
            className="inline-flex min-h-11 w-fit items-center gap-3 text-sm font-bold outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] focus-visible:ring-offset-4 focus-visible:ring-offset-[#fbf8f1] dark:hover:text-[#c7896d] dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#121417]"
          >
            Akışa katıl
            <span aria-hidden="true">↑</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
