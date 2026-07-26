"use client";

import { useState } from "react";

const campusTopics = [
  {
    number: "01",
    title: "İtiraflar ve sorular",
    description: "Aklındakini anonim paylaş, diğer öğrenciler yanıtlasın.",
    tag: "Anonim",
  },
  {
    number: "02",
    title: "Kayıp eşya",
    description: "Kaybettiğin ya da bulduğun eşyayı kampüse duyur.",
    tag: "Yardımlaşma",
  },
  {
    number: "03",
    title: "Dersler ve kampüs",
    description: "Dersler, kütüphane ve kampüs hayatı hakkında soru sor.",
    tag: "Ders",
  },
  {
    number: "04",
    title: "Topluluklar ve etkinlikler",
    description: "Toplulukları ve yaklaşan etkinlikleri tek yerde gör.",
    tag: "Etkinlik",
  },
];

const pollOptions = ["Evet, kesinlikle", "Hayır, şu anki saatler yeterli"];

export default function CampusPulseSection() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  return (
    <section
      id="kampus-nabzi"
      aria-labelledby="campus-pulse-title"
      className="campus-pulse-surface relative overflow-x-clip border-b border-[#1c2821]/14 text-[#1c2821] dark:border-white/10 dark:text-[#ece8e1]"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto w-full max-w-[1360px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <header className="grid gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:gap-20">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-2.5 rotate-45 bg-[#b5412f] dark:bg-[#c7896d]"
              />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f3427] dark:text-[#c7896d] sm:text-xs">
                Kampüs Nabzı
              </p>
            </div>
            <h2
              id="campus-pulse-title"
              className="max-w-4xl text-[clamp(2.7rem,7vw,5.8rem)] font-black leading-[0.92] tracking-[-0.06em]"
            >
              Sadece itiraf değil.
              <span className="block font-serif font-normal italic text-[#a83d2d] dark:text-[#c7896d]">
                Kampüste olup biten burada.
              </span>
            </h2>
          </div>

          <p className="max-w-xl text-base leading-7 text-[#1c2821]/65 dark:text-white/65 sm:text-lg sm:leading-8 lg:justify-self-end">
            İtirafların yanında ders soruları, kayıp eşya ilanları, etkinlikler
            ve öğrenci toplulukları da burada.
          </p>
        </header>

        <div className="mt-12 grid gap-10 border-t border-[#1c2821]/16 pt-10 dark:border-white/12 sm:mt-14 sm:pt-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
          <article className="self-start rounded-[1.4rem] border border-[#1c2821]/16 bg-[#fbf8f1] p-5 shadow-[0_18px_55px_rgba(28,40,33,0.09)] dark:border-white/12 dark:bg-[#202126] dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#963629] dark:text-[#c7896d]">
                Günün sorusu
              </p>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#1c2821]/62 dark:text-white/60">
                24 saat
              </span>
            </div>

            <h3 className="mt-8 max-w-lg text-2xl font-black leading-[1.08] tracking-[-0.045em] sm:text-3xl">
              Final haftasında kütüphane 24 saat açık olmalı mı?
            </h3>

            <div className="mt-8 grid gap-3">
              {pollOptions.map((option, index) => {
                const isSelected = selectedOption === option;

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedOption(option)}
                    className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#1c2821]/20 dark:focus-visible:ring-white/20 ${
                      isSelected
                        ? "border-[#6e2035] bg-[#6e2035] text-[#fbf8f1] dark:border-[#c7896d] dark:bg-[#c7896d] dark:text-[#121417]"
                        : "border-[#1c2821]/15 bg-transparent hover:border-[#1c2821]/35 dark:border-white/14 dark:hover:border-white/32 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {option}
                    <span className="font-mono text-[10px] opacity-55">
                      0{index + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <p
              role="status"
              aria-live="polite"
              className="mt-5 min-h-5 text-xs leading-5 text-[#1c2821]/65 dark:text-white/65"
            >
              {selectedOption
                ? `“${selectedOption}” seçeneğine oy verdin.`
                : "Bir seçeneğe dokunup oy ver."}
            </p>
          </article>

          <ol className="border-t border-[#1c2821]/16 dark:border-white/12">
            {campusTopics.map((topic) => (
              <li
                key={topic.number}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-[#1c2821]/16 py-5 dark:border-white/12 sm:grid-cols-[2.5rem_1fr_auto] sm:items-center sm:gap-6 sm:py-7"
              >
                <span className="font-mono text-[10px] font-bold text-[#963629] dark:text-[#c7896d]">
                  {topic.number}
                </span>
                <div>
                  <h3 className="text-lg font-black tracking-[-0.035em]">
                    {topic.title}
                  </h3>
                  <p className="mt-1.5 hidden text-sm leading-6 text-[#1c2821]/64 dark:text-white/64 sm:block">
                    {topic.description}
                  </p>
                </div>
                <span className="col-start-2 w-fit border border-[#1c2821]/16 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#1c2821]/62 dark:border-white/14 dark:text-white/60 sm:col-auto">
                  {topic.tag}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-[#1c2821]/16 pt-7 dark:border-white/12 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">
              Gönderiyi arkadaşlarınla paylaş.
            </p>
            <p className="mt-1 hidden text-xs leading-5 text-[#1c2821]/65 dark:text-white/65 sm:block">
              Paylaşırken e-posta adresin ve kimlik bilgilerin görünmez.
            </p>
          </div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#1c2821]/62 dark:text-white/60">
            WhatsApp · Instagram · Bağlantıyı kopyala
          </p>
        </div>
      </div>
    </section>
  );
}
