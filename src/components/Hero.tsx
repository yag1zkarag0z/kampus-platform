"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import Link from "next/link";
import CampusFeedPanel from "@/components/CampusFeedPanel";
import CampusLogo from "@/components/CampusLogo";
import ThemeToggle from "@/components/ThemeToggle";

gsap.registerPlugin(useGSAP);

const features = [
  {
    title: "Anonim paylaş",
    description: "Adını göstermeden istediğini yaz.",
  },
  {
    title: "Günlük ihtiyaçlar",
    description: "Ders soruları, kayıp eşya ve duyurular.",
  },
  {
    title: "Sadece Yaşar",
    description: "Yalnızca Yaşar öğrencilerine açık.",
  },
];

const tickerItems = [
  "Yaşar gündemi",
  "İtiraflar",
  "Ders soruları",
  "Kayıp eşya",
  "Öğrenci etkinlikleri",
  "Kampüs Nabzı",
];

const navItems = [
  { href: "#kampus-nabzi", label: "Kampüs Nabzı" },
  { href: "#nasil-calisir", label: "Nasıl çalışır?" },
  { href: "#guvenlik", label: "Güvenlik" },
];

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateTo = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.preventDefault();
    const target = document.querySelector<HTMLElement>(href);

    setMenuOpen(false);
    if (!target) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    window.history.pushState(null, "", href);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({
          defaults: {
            duration: 0.7,
            ease: "power3.out",
          },
        });

        timeline
          .from(".hero-nav", { y: -14, opacity: 0 })
          .from(".hero-kicker", { y: 12, opacity: 0 }, "-=0.34")
          .from(
            ".hero-title-line",
            { yPercent: 112, stagger: 0.1 },
            "-=0.42"
          )
          .from(
            ".hero-description",
            { y: 16, opacity: 0 },
            "-=0.38"
          )
          .from(
            ".hero-disclaimer",
            { y: 10, opacity: 0 },
            "-=0.42"
          )
          .from(
            ".hero-feed-shell",
            { y: 24, rotate: 0.75, opacity: 0, duration: 0.9 },
            "-=0.48"
          )
          .from(
            ".prism-emoji",
            {
              y: 20,
              scale: 0.45,
              opacity: 0,
              stagger: 0.1,
              duration: 0.65,
            },
            "-=0.72"
          )
          .from(
            ".feed-item",
            { y: 12, opacity: 0, stagger: 0.07, duration: 0.55 },
            "-=0.62"
          )
          .from(
            ".hero-feature",
            { y: 12, opacity: 0, stagger: 0.06 },
            "-=0.42"
          )
          .to(
            ".prism-emoji",
            {
              y: -8,
              rotation: 4,
              duration: 2.8,
              stagger: 0.35,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            },
            "+=0.12"
          );
      });

      return () => media.revert();
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      className="relative isolate flex min-h-[100svh] flex-col overflow-x-clip bg-[#eee9e1] text-[#1c2821] transition-colors dark:bg-[#111315] dark:text-[#ece8e1]"
    >
      <div
        aria-hidden="true"
        className="hero-gradient-motion pointer-events-none absolute inset-0 -z-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[-30%] -z-20 w-[74%] -skew-x-6 bg-[linear-gradient(155deg,rgba(59,32,40,0.14)_0%,rgba(154,89,68,0.13)_42%,rgba(119,116,138,0.13)_70%,rgba(238,233,225,0)_92%)] sm:right-[-20%] sm:w-[62%] lg:right-[-8%] lg:w-[48%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[35%] -z-20 h-px w-[40%] bg-gradient-to-r from-[#1c2821]/16 to-transparent dark:from-white/14"
      />
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-5 sm:px-8 lg:px-12">
        <header className="hero-nav relative z-50 flex min-h-[4.5rem] items-center justify-between border-b border-[#1c2821]/14 transition-colors dark:border-white/12 sm:min-h-20">
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <a
              href="#"
              className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] focus-visible:ring-offset-4 focus-visible:ring-offset-[#eee9e1] dark:focus-visible:ring-[#ece8e1] dark:focus-visible:ring-offset-[#111315]"
              aria-label="Kampüs ana sayfa"
            >
              <CampusLogo
                idPrefix="hero-nav-logo"
                wordmarkClassName="text-lg sm:text-xl"
              />
            </a>
            <span className="hidden border-l border-[#1c2821]/18 pl-4 font-mono text-[9px] font-bold uppercase leading-4 tracking-[0.13em] text-[#1c2821]/62 dark:border-white/16 dark:text-[#ece8e1]/62 sm:block">
              Yaşar
              <br />
              Bornova
            </span>
          </div>

          <nav
            aria-label="Ana menü"
            className="hidden items-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#1c2821]/62 dark:text-[#ece8e1]/65 md:flex md:gap-4 lg:gap-6 xl:gap-8 xl:text-xs"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => navigateTo(event, item.href)}
                className="inline-flex min-h-11 items-center outline-none transition-colors hover:text-[#1c2821] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#ece8e1] dark:focus-visible:ring-[#ece8e1]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold xl:gap-6">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#1c2821]/62 dark:text-[#ece8e1]/58 xl:inline">
              Bağımsız öğrenci ağı
            </span>

            <div className="hidden md:block">
              <ThemeToggle className="size-11 px-0" />
            </div>

            <div className="hidden items-center gap-2 md:flex lg:gap-3">
              <Link
                href="/giris"
                className="inline-flex min-h-11 items-center px-2 text-[13px] outline-none transition-colors hover:text-[#8f3427] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#c7896d] dark:focus-visible:ring-[#ece8e1] lg:px-3 lg:text-sm"
              >
                Giriş yap
              </Link>
              <Link
                href="/kayit"
                className="inline-flex min-h-11 items-center rounded-full bg-[#5a1f32] px-4 text-[13px] font-bold text-[#fffaf4] shadow-[0_8px_24px_rgba(90,31,50,0.16)] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/30 focus-visible:ring-offset-3 focus-visible:ring-offset-[#eee9e1] dark:bg-[#9a5944] dark:shadow-none dark:hover:bg-[#ad6b53] dark:focus-visible:ring-[#c7896d]/35 dark:focus-visible:ring-offset-[#111315] lg:px-5 lg:text-sm"
              >
                Kayıt ol
              </Link>
            </div>

            <div className="md:hidden">
              <ThemeToggle className="size-11 px-0" />
            </div>

            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-haspopup="true"
              aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
              onClick={() => setMenuOpen((current) => !current)}
              className="relative z-[70] grid size-11 cursor-pointer place-items-center rounded-full border border-[#5a1f32]/22 bg-[#fffaf4]/72 text-[#42192b] shadow-[0_8px_24px_rgba(90,31,50,0.08)] outline-none transition-colors hover:border-[#5a1f32]/40 hover:bg-[#fffaf4] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:border-white/14 dark:bg-white/7 dark:text-[#ece8e1] dark:shadow-none dark:hover:border-[#c7896d]/45 dark:hover:bg-white/10 md:hidden"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-4.5"
              >
                <path
                  d={
                    menuOpen
                      ? "M5 5l10 10M15 5 5 15"
                      : "M3 5h14M3 10h14M3 15h14"
                  }
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {menuOpen && (
            <nav
              id="mobile-navigation"
              aria-label="Mobil menü"
              className="mobile-nav-panel absolute inset-x-0 top-[calc(100%+0.65rem)] z-[60] overflow-hidden rounded-2xl border border-[#5a1f32]/16 bg-[#fffaf4]/98 p-2 text-sm font-bold shadow-[0_24px_70px_rgba(55,29,35,0.2)] backdrop-blur-xl dark:border-[#9a5944]/30 dark:bg-[#191b1f]/98 dark:text-[#ece8e1] md:hidden"
            >
              <div
                aria-hidden="true"
                className="h-1 rounded-full bg-[linear-gradient(90deg,#3b2028_0%,#9a5944_52%,#77748a_100%)]"
              />

              <div className="grid px-2 pt-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(event) => navigateTo(event, item.href)}
                    className="flex min-h-12 items-center justify-between border-b border-[#1c2821]/10 outline-none transition-colors last:border-b-0 hover:text-[#8f3427] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#5a1f32] dark:border-white/10 dark:hover:text-[#c7896d] dark:focus-visible:ring-[#c7896d]"
                  >
                    {item.label}
                    <span aria-hidden="true" className="text-[#a83d2d]">
                      ↘
                    </span>
                  </a>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-[#1c2821]/10 p-2 pt-4 dark:border-white/10">
                <Link
                  href="/giris"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#5a1f32]/18 bg-white/45 outline-none transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-[#5a1f32] dark:border-white/14 dark:bg-white/6 dark:hover:bg-white/10 dark:focus-visible:ring-[#c7896d]"
                >
                  Giriş yap
                </Link>
                <Link
                  href="/kayit"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#5a1f32] text-[#fffaf4] shadow-[0_8px_22px_rgba(90,31,50,0.18)] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/30 dark:bg-[#9a5944] dark:shadow-none dark:hover:bg-[#ad6b53] dark:focus-visible:ring-[#c7896d]/35"
                >
                  Kayıt ol
                </Link>
              </div>
            </nav>
          )}
        </header>

        {menuOpen && (
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-[#251820]/12 backdrop-blur-[1px] dark:bg-black/35 md:hidden"
          />
        )}

        <main className="grid flex-1 gap-8 py-8 sm:gap-10 sm:py-11 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:items-center lg:gap-x-14 lg:gap-y-8 lg:py-10 xl:gap-x-24 xl:py-14">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
            <div className="hero-kicker mb-6 flex items-center gap-3 sm:mb-7">
              <span
                aria-hidden="true"
                className="size-2.5 rotate-45 bg-[#b5412f] dark:bg-[#c7896d]"
              />
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#8f3427] dark:text-[#c7896d] sm:text-xs">
                Yaşar öğrencilerinin bağımsız kampüs ağı
              </p>
            </div>

            <h1 className="text-[clamp(3.15rem,15vw,5.5rem)] font-black leading-[0.87] tracking-[-0.065em] md:text-[clamp(5rem,8.2vw,6.8rem)]">
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="hero-title-line block">Yaşar’da</span>
              </span>
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="hero-title-line block">bugün ne</span>
              </span>
              <span className="block overflow-hidden pb-[0.12em]">
                <span className="hero-title-line block font-serif text-[0.68em] font-normal italic tracking-[-0.045em] text-[#a83d2d] dark:text-[#d09272]">
                  konuşuluyor?
                </span>
              </span>
            </h1>

            <p className="hero-description mt-5 max-w-xl text-base leading-7 text-[#1c2821]/68 dark:text-[#ece8e1]/70 sm:mt-7 sm:text-lg sm:leading-8">
              Kampüste olup biteni tek yerde gör.
              <span className="hidden sm:inline">
                {" "}
                İtirafını paylaş, sorunu sor, kayıp eşyanı duyur.
              </span>{" "}
              Yalnızca
              <span className="font-semibold text-[#1c2821] dark:text-[#ece8e1]">
                {" "}
                @stu.yasar.edu.tr
              </span>{" "}
              adresini doğrulayan öğrenciler katılabilir.
            </p>

            <aside
              aria-label="Resmî platform uyarısı"
              className="hero-disclaimer mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-[#8f3427]/20 bg-[#fffaf4]/72 px-3.5 py-3 shadow-[0_10px_30px_rgba(80,35,29,0.06)] backdrop-blur-[2px] dark:border-[#c7896d]/22 dark:bg-[#1a1c20]/72 dark:shadow-[0_12px_34px_rgba(0,0,0,0.2)] sm:px-4"
            >
              <span
                aria-hidden="true"
                className="mt-1 h-9 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,#9a5944_0%,#77748a_100%)]"
              />
              <span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8f3427] dark:text-[#c7896d] sm:text-[10px]">
                  Önemli not
                </span>
                <span className="mt-1 block text-xs font-medium leading-5 text-[#1c2821]/74 dark:text-[#ece8e1]/72 sm:text-[13px]">
                  <strong className="font-black text-[#1c2821] dark:text-[#ece8e1]">
                    KAMPÜS bağımsız bir öğrenci projesidir.
                  </strong>{" "}
                  <strong className="font-black text-[#8f3427] dark:text-[#d09272]">
                    Yaşar Üniversitesi’nin resmî platformu değildir.
                  </strong>{" "}
                  <span className="hidden sm:inline">
                    Üniversite tarafından işletilmez veya desteklenmez.
                  </span>
                </span>
              </span>
            </aside>
          </div>

          <div
            id="giris"
            className="relative isolate mx-auto w-full max-w-[29.5rem] min-w-0 scroll-mt-6 pt-20 sm:pt-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:pt-32 lg:justify-self-end lg:self-center"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-8 left-1/2 -z-10 h-64 w-[118%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(119,116,138,0.24)_0%,rgba(154,89,68,0.18)_38%,transparent_72%)] blur-2xl"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-3 z-20 w-14 -rotate-12 select-none sm:left-8 sm:top-6 sm:w-20 lg:left-2 lg:top-8 lg:w-24 xl:-left-8"
            >
              <div className="prism-emoji w-full will-change-transform">
                <Image
                  src="/images/prism/speech-bubble.png"
                  alt=""
                  width={640}
                  height={622}
                  sizes="(min-width: 1024px) 96px, (min-width: 640px) 80px, 56px"
                  className="h-auto w-full drop-shadow-[0_16px_24px_rgba(76,35,84,0.22)]"
                  draggable={false}
                />
              </div>
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 z-20 w-[4.5rem] -translate-x-1/2 rotate-3 select-none sm:-top-1 sm:w-24 lg:w-28"
            >
              <div className="prism-emoji w-full will-change-transform">
                <Image
                  src="/images/prism/student-backpack.png"
                  alt=""
                  width={550}
                  height={640}
                  sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 72px"
                  className="h-auto w-full drop-shadow-[0_18px_28px_rgba(76,35,84,0.24)]"
                  draggable={false}
                />
              </div>
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 z-20 w-14 rotate-12 select-none sm:right-8 sm:top-6 sm:w-20 lg:right-2 lg:top-8 lg:w-24 xl:-right-8"
            >
              <div className="prism-emoji w-full will-change-transform">
                <Image
                  src="/images/prism/megaphone.png"
                  alt=""
                  width={640}
                  height={571}
                  sizes="(min-width: 1024px) 96px, (min-width: 640px) 80px, 56px"
                  className="h-auto w-full drop-shadow-[0_16px_24px_rgba(76,35,84,0.22)]"
                  draggable={false}
                />
              </div>
            </div>

            <div className="relative z-10">
              <CampusFeedPanel />
            </div>
          </div>

          <ol className="grid gap-0 sm:grid-cols-3 lg:col-start-1 lg:row-start-2 lg:self-start">
            {features.map((feature, index) => (
              <li
                key={feature.title}
                className="hero-feature grid grid-cols-[2.25rem_1fr] gap-2 border-t border-[#1c2821]/18 py-3.5 dark:border-white/14 sm:block sm:pr-5 sm:pt-4"
              >
                <span className="font-mono text-[11px] font-bold text-[#963629] dark:text-[#c7896d]">
                  0{index + 1}
                </span>
                <div>
                  <h2 className="text-sm font-bold">{feature.title}</h2>
                  <p className="mt-1 hidden text-xs leading-5 text-[#1c2821]/65 dark:text-[#ece8e1]/62 sm:block">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </main>
      </div>

      <div className="campus-marquee shrink-0 overflow-hidden border-y border-[#1c2821]/20 bg-[#1c2821] py-3 text-[#f8f4eb] dark:border-white/10 dark:bg-[#0c0e10] sm:py-3.5">
        <p className="sr-only">
          Yaşar öğrenci akışı: itiraflar, ders soruları, kayıp ve buluntu,
          öğrenci etkinlikleri ve Kampüs Nabzı.
        </p>
        <div className="campus-marquee-track flex w-max items-center">
          {[0, 1].map((group) => (
            <div
              key={group}
              aria-hidden="true"
              className="campus-marquee-group flex min-w-[100vw] shrink-0 items-center justify-around gap-[clamp(1.5rem,4vw,4rem)] px-[clamp(1rem,3vw,3rem)]"
            >
              {tickerItems.map((item) => (
                <span
                  key={item}
                  className="flex shrink-0 items-center text-[10px] font-bold uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.18em]"
                >
                  {item}
                  <span
                    aria-hidden="true"
                    className="ml-[clamp(1.5rem,4vw,4rem)] size-1 rotate-45 bg-[#df765d]"
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
