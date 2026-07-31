"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import Link from "next/link";
import CampusFeedPanel from "@/components/CampusFeedPanel";
import CampusLogo from "@/components/CampusLogo";
import HeroParticles, {
  createHeroParticles,
} from "@/components/HeroParticles";

gsap.registerPlugin(useGSAP);


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
  { href: "#sss", label: "SSS" },
];

const heroParticles = createHeroParticles(52);

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQueryList = window.matchMedia(reducedMotionMediaQuery);

  mediaQueryList.addEventListener("change", onChange);

  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionMediaQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

interface TypewriterLine {
  text: string;
  wrapperClassName: string;
  className: string;
}

const headlineLines: TypewriterLine[] = [
  {
    text: "Yaşar’da",
    wrapperClassName: "block min-h-[0.95em] overflow-hidden pb-[0.08em]",
    className: "block",
  },
  {
    text: "bugün ne",
    wrapperClassName: "block min-h-[0.95em] overflow-hidden pb-[0.08em]",
    className: "block",
  },
  {
    text: "konuşuluyor?",
    wrapperClassName: "block min-h-[0.8em] overflow-hidden pb-[0.12em]",
    className:
      "block font-serif text-[0.68em] font-normal italic tracking-[-0.045em] text-[#ff7a45]",
  },
];

const TYPE_SPEED_MS = 70;
const ERASE_SPEED_MS = 38;
const START_DELAY_MS = 350;
const HOLD_DURATION_MS = 1700;
const PAUSE_DURATION_MS = 550;

function useTypewriterLoop(lines: TypewriterLine[]) {
  const reduceMotion = usePrefersReducedMotion();
  // The headline starts fully typed out (no type-in on first paint) and
  // only begins erasing/retyping after the initial hold below.
  const [displayed, setDisplayed] = useState<string[]>(() =>
    lines.map((line) => line.text)
  );
  const [cursorLine, setCursorLine] = useState(lines.length - 1);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    let cancelled = false;
    const pendingTimeouts = new Set<number>();

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          pendingTimeouts.delete(id);
          resolve();
        }, ms) as unknown as number;
        pendingTimeouts.add(id);
      });

    const setLineText = (lineIndex: number, text: string) => {
      setDisplayed((previous) => {
        const next = [...previous];
        next[lineIndex] = text;
        return next;
      });
    };

    async function run() {
      await wait(START_DELAY_MS);

      while (!cancelled) {
        await wait(HOLD_DURATION_MS);

        if (cancelled) return;

        for (
          let lineIndex = lines.length - 1;
          lineIndex >= 0;
          lineIndex -= 1
        ) {
          setCursorLine(lineIndex);

          const characters = Array.from(lines[lineIndex].text);

          for (
            let count = characters.length - 1;
            count >= 0;
            count -= 1
          ) {
            if (cancelled) return;

            setLineText(
              lineIndex,
              characters.slice(0, count).join("")
            );

            await wait(ERASE_SPEED_MS);

            if (cancelled) return;
          }
        }

        await wait(PAUSE_DURATION_MS);

        if (cancelled) return;

        for (
          let lineIndex = 0;
          lineIndex < lines.length;
          lineIndex += 1
        ) {
          setCursorLine(lineIndex);

          const characters = Array.from(lines[lineIndex].text);

          for (
            let count = 1;
            count <= characters.length;
            count += 1
          ) {
            if (cancelled) return;

            setLineText(
              lineIndex,
              characters.slice(0, count).join("")
            );

            await wait(TYPE_SPEED_MS);

            if (cancelled) return;
          }
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      pendingTimeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [lines, reduceMotion]);

  return {
    displayed: reduceMotion ? lines.map((line) => line.text) : displayed,
    cursorLine,
    showCursor: !reduceMotion,
  };
}

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const { displayed, cursorLine, showCursor } =
    useTypewriterLoop(headlineLines);

  const navigateTo = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.preventDefault();

    const target = document.querySelector<HTMLElement>(href);

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

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        "(prefers-reduced-motion: no-preference)",
        () => {
          // Kept intentionally small: one short entrance pass, then done.
          // The prism icons' idle float runs as a plain CSS animation
          // instead (see .prism-emoji in globals.css) so GSAP doesn't
          // need to keep an infinite timeline ticking in the background.
          const timeline = gsap.timeline({
            defaults: {
              duration: 0.6,
              ease: "power3.out",
            },
          });

          timeline
            .from(".hero-nav", {
              y: -14,
              opacity: 0,
            })
            .from(
              [".hero-kicker", ".hero-description", ".hero-disclaimer"],
              {
                y: 14,
                opacity: 0,
                stagger: 0.08,
              },
              "-=0.3"
            )
            .from(
              [".hero-feed-shell", ".prism-slot"],
              {
                y: 18,
                opacity: 0,
                stagger: 0.06,
                duration: 0.7,
              },
              "-=0.3"
            )
            .from(
              [".feed-item", ".hero-feature"],
              {
                y: 10,
                opacity: 0,
                stagger: 0.05,
                duration: 0.5,
              },
              "-=0.35"
            );
        }
      );

      return () => media.revert();
    },
    {
      scope: heroRef,
    }
  );

  return (
    <section
      ref={heroRef}
      className="relative isolate flex min-h-[100svh] flex-col overflow-x-clip bg-[#05060a] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(ellipse_120%_80%_at_82%_-8%,rgba(255,122,69,0.16)_0%,transparent_55%),radial-gradient(ellipse_90%_70%_at_-8%_112%,rgba(94,74,196,0.14)_0%,transparent_58%),linear-gradient(175deg,#05060a_0%,#0a0d16_55%,#0e1220_100%)]"
      />

      <HeroParticles particles={heroParticles} className="-z-20" />

      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-5 sm:px-8 lg:px-12">
        <header className="hero-nav relative z-50 flex min-h-[4.5rem] items-center justify-between border-b border-white/12 sm:min-h-20">
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <a
              href="#"
              className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#05060a]"
              aria-label="Kampüs ana sayfa"
            >
              <CampusLogo
                idPrefix="hero-nav-logo"
                wordmarkClassName="text-lg sm:text-xl"
              />
            </a>

            <span className="hidden border-l border-white/16 pl-4 font-mono text-[9px] font-bold uppercase leading-4 tracking-[0.13em] text-white/55 sm:block">
              Yaşar
              <br />
              Bornova
            </span>
          </div>

          <nav
            aria-label="Ana menü"
            className="hidden items-center text-[11px] font-bold uppercase tracking-[0.12em] text-white/60 md:flex md:gap-4 lg:gap-6 xl:gap-8 xl:text-xs"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) =>
                  navigateTo(event, item.href)
                }
                className="inline-flex min-h-11 items-center outline-none transition-colors hover:text-white focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold xl:gap-6">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-white/50 xl:inline">
              Bağımsız öğrenci ağı
            </span>

            <div className="flex items-center gap-2 lg:gap-3">
              <Link
                href="/giris"
                className="inline-flex min-h-11 items-center px-2 text-[13px] text-white/75 outline-none transition-colors hover:text-white focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white lg:px-3 lg:text-sm"
              >
                Giriş yap
              </Link>

              <Link
                href="/kayit"
                className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[13px] font-bold text-[#12100e] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:ring-offset-3 focus-visible:ring-offset-[#05060a] lg:px-5 lg:text-sm"
              >
                Kayıt ol
              </Link>
            </div>
          </div>
        </header>

        <main
          className="grid flex-1 gap-8 py-8 sm:gap-10 sm:py-11 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:items-center lg:gap-x-14 lg:gap-y-8 lg:py-10 xl:gap-x-24 xl:py-14"
        >
          <div className="min-w-0 text-center lg:col-start-1 lg:row-start-1 lg:self-end lg:text-left">
            <div className="hero-kicker mb-6 flex items-center justify-center gap-3 sm:mb-7 lg:justify-start">
              <span
                aria-hidden="true"
                className="size-2.5 rotate-45 bg-[#ff7a45]"
              />

              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff7a45] sm:text-xs">
                Yaşar öğrencilerinin bağımsız kampüs ağı
              </p>
            </div>

            <h1 className="text-[clamp(3.15rem,15vw,5rem)] font-black leading-[0.87] tracking-[-0.065em] md:text-[clamp(5rem,8.2vw,6.8rem)]">
              <span className="sr-only">
                Yaşar’da bugün ne konuşuluyor?
              </span>

              {headlineLines.map((line, index) => (
                <span
                  key={line.text}
                  aria-hidden="true"
                  className={line.wrapperClassName}
                >
                  <span className={line.className}>
                    {displayed[index]}

                    <span
                      aria-hidden="true"
                      className={[
                        "ml-[0.045em] inline-block",
                        "h-[0.76em] w-[0.045em]",
                        "translate-y-[0.04em] bg-current",
                        "transition-opacity",
                        showCursor && cursorLine === index
                          ? "animate-pulse opacity-100"
                          : "opacity-0",
                      ].join(" ")}
                    />
                  </span>
                </span>
              ))}
            </h1>

            <p className="hero-description mx-auto mt-5 max-w-xl text-base leading-7 text-white/78 sm:mt-7 sm:text-lg sm:leading-8 lg:mx-0">
              Kampüste olup biteni tek yerde gör.

              <span className="hidden sm:inline">
                {" "}
                İtirafını paylaş, sorunu sor, kayıp eşyanı
                duyur.
              </span>{" "}

              Yalnızca

              <span className="font-semibold text-white">
                {" "}
                @stu.yasar.edu.tr
              </span>{" "}

              adresini doğrulayan öğrenciler katılabilir.
            </p>

            <aside
              aria-label="Resmî platform uyarısı"
              className="hero-disclaimer mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-white/12 bg-black/48 px-3.5 py-3 text-left backdrop-blur-[3px] sm:px-4 lg:mx-0"
            >
              <span
                aria-hidden="true"
                className="mt-1 h-9 w-1 shrink-0 rounded-full bg-[#ff7a45]"
              />

              <span>
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#ff7a45] sm:text-[10px]">
                  Önemli not
                </span>

                <span className="mt-1 block text-xs font-medium leading-5 text-white/78 sm:text-[13px]">
                  <strong className="font-black text-white">
                    KAMPÜS bağımsız bir öğrenci projesidir.
                  </strong>{" "}

                  <strong className="font-black text-[#ff7a45]">
                    Yaşar Üniversitesi’nin resmî platformu
                    değildir.
                  </strong>{" "}

                  <span className="hidden sm:inline">
                    Üniversite tarafından işletilmez veya
                    desteklenmez.
                  </span>
                </span>
              </span>
            </aside>
          </div>

          <div
            id="giris"
            className="relative isolate mr-auto w-full max-w-[29.5rem] min-w-0 scroll-mt-6 pt-20 sm:pt-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mr-0 lg:pt-0 lg:justify-self-end lg:self-center"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-8 left-1/2 -z-10 h-64 w-[118%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,122,69,0.18)_0%,transparent_70%)] blur-2xl lg:-top-40"
            />

            <div
              aria-hidden="true"
              className="prism-slot pointer-events-none absolute left-4 top-3 z-20 w-14 -rotate-12 select-none sm:left-8 sm:top-6 sm:w-20 lg:-top-24 lg:left-2 lg:w-24 xl:-left-8"
            >
              <div
                className="prism-emoji w-full will-change-transform"
                style={{ animationDelay: "0s" }}
              >
                <Image
                  src="/images/prism/speech-bubble.png"
                  alt=""
                  width={640}
                  height={622}
                  sizes="(min-width: 1024px) 96px, (min-width: 640px) 80px, 56px"
                  className="h-auto w-full drop-shadow-[0_16px_24px_rgba(0,0,0,0.4)]"
                  draggable={false}
                />
              </div>
            </div>

            <div
              aria-hidden="true"
              className="prism-slot pointer-events-none absolute left-1/2 top-0 z-20 w-[4.5rem] -translate-x-1/2 rotate-3 select-none sm:-top-1 sm:w-24 lg:-top-32 lg:w-28"
            >
              <div
                className="prism-emoji w-full will-change-transform"
                style={{ animationDelay: "-1.9s" }}
              >
                <Image
                  src="/images/prism/student-backpack.png"
                  alt=""
                  width={550}
                  height={640}
                  sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 72px"
                  className="h-auto w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.44)]"
                  draggable={false}
                />
              </div>
            </div>

            <div
              aria-hidden="true"
              className="prism-slot pointer-events-none absolute right-4 top-3 z-20 w-14 rotate-12 select-none sm:right-8 sm:top-6 sm:w-20 lg:-top-24 lg:right-2 lg:w-24 xl:-right-8"
            >
              <div
                className="prism-emoji w-full will-change-transform"
                style={{ animationDelay: "-3.7s" }}
              >
                <Image
                  src="/images/prism/megaphone.png"
                  alt=""
                  width={640}
                  height={571}
                  sizes="(min-width: 1024px) 96px, (min-width: 640px) 80px, 56px"
                  className="h-auto w-full drop-shadow-[0_16px_24px_rgba(0,0,0,0.4)]"
                  draggable={false}
                />
              </div>
            </div>

            <div className="relative z-10 lg:translate-y-[-24.5px]">
              <CampusFeedPanel />
            </div>
          </div>

        </main>
      </div>

      <div className="campus-marquee shrink-0 overflow-hidden border-y border-white/10 bg-[#0a0a0b] py-3 text-white sm:py-3.5">
        <p className="sr-only">
          Yaşar öğrenci akışı: itiraflar, ders soruları,
          kayıp ve buluntu, öğrenci etkinlikleri ve Kampüs
          Nabzı.
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
                    className="ml-[clamp(1.5rem,4vw,4rem)] size-1 rotate-45 bg-[#ff7a45]"
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
