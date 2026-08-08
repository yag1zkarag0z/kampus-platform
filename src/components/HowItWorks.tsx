import Link from "next/link";

const steps = [
  {
    number: "01",
    label: "Doğrula",
    title: "Öğrenci hesabını aç.",
    description: "@stu.yasar.edu.tr adresine gelen kodu gir.",
  },
  {
    number: "02",
    label: "Keşfet",
    title: "Kampüs akışına göz at.",
    description: "Soruları, duyuruları ve kampüs gündemini tek yerde gör.",
  },
  {
    number: "03",
    label: "Katıl",
    title: "Paylaşmaya başla.",
    description: "Gönderini adınla veya anonim olarak yayınla.",
  },
];

export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="border-b border-white/10 bg-canvas text-white"
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand sm:text-xs">
            Nasıl çalışır?
          </p>
          <h1
            id="how-it-works-title"
            className="mt-5 text-[clamp(2.8rem,7vw,5.8rem)] font-medium leading-[0.95] tracking-[-0.06em]"
          >
            Üç adımda KAMPÜS<span className="text-brand">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/56 sm:text-lg">
            Doğrula, keşfet ve kampüs sohbetine katıl.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 md:mt-16 md:grid-cols-3 md:gap-4">
          {steps.map((step) => (
            <li
              key={step.number}
              className="flex min-h-64 flex-col rounded-2xl border border-white/10 bg-surface p-6 sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs font-bold text-brand">
                  {step.number}
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
                  {step.label}
                </span>
              </div>
              <div className="mt-auto pt-12">
                <h2 className="text-2xl font-semibold leading-tight tracking-[-0.04em]">
                  {step.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/52">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/giris"
            className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-white/88 focus-visible:ring-3 focus-visible:ring-white/35"
          >
            Misafir olarak dene
          </Link>
          <Link
            href="/kayit"
            className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/14 px-6 text-sm font-bold outline-none transition-colors hover:border-white/28 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white"
          >
            Kayıt ol
          </Link>
        </div>
      </div>
    </section>
  );
}
