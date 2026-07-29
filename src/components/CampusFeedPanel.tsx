"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthClientError,
  startGuestSession,
} from "@/auth/client";
import CampusLogo from "@/components/CampusLogo";

export default function CampusFeedPanel() {
  const router = useRouter();
  const [isOpeningGuestView, setIsOpeningGuestView] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const continueAsGuest = async () => {
    if (isOpeningGuestView) {
      return;
    }

    setGuestError(null);
    setIsOpeningGuestView(true);

    try {
      await startGuestSession();
      router.push("/akis");
    } catch (error) {
      setGuestError(
        error instanceof AuthClientError
          ? error.message
          : "Misafir görünümü şu anda açılamıyor.",
      );
      setIsOpeningGuestView(false);
    }
  };

  return (
    <aside
      aria-label="Yaşar’da bugün"
      className="hero-feed-shell overflow-hidden rounded-[1.5rem] border border-[#1c2821]/15 bg-[#fbf8f1] shadow-[0_24px_70px_rgba(28,40,33,0.13)] transition-colors dark:border-white/12 dark:bg-[#1a1c20] dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#1c2821]/12 px-3 dark:border-white/10 sm:min-h-16 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <CampusLogo
            variant="mark"
            idPrefix="campus-feed-logo"
            markClassName="h-8 w-6"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-[-0.025em]">
              Yaşar’da bugün
            </p>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[#1c2821]/62 dark:text-[#ece8e1]/58">
              Selçuk Yaşar Kampüsü
            </p>
          </div>
        </div>

        <span className="hidden border border-[#1c2821]/14 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.13em] text-[#963629] dark:border-white/12 dark:text-[#c7896d] min-[380px]:inline-flex">
          Kampüs akışı
        </span>
      </header>

      <div className="grid gap-2.5 p-2.5 sm:gap-4 sm:p-4">
        <article className="feed-item min-w-0 rounded-[1.15rem] border border-[#1c2821]/13 bg-[#fffdfa] p-3 dark:border-white/10 dark:bg-[#222329] sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#1c2821]/62 dark:text-[#ece8e1]/58">
            <span className="text-[#9b3829] dark:text-[#d09272]">Anonim</span>
            <span aria-hidden="true">·</span>
            <span>12 dk önce</span>
          </div>

          <p className="mt-3 text-[1.05rem] font-semibold leading-6 tracking-[-0.02em] text-[#1c2821] dark:text-[#ece8e1] sm:mt-4 sm:text-lg sm:leading-7">
            Final haftası kütüphanede sessizce çalışacak birilerini arıyorum.
            <span className="hidden sm:inline"> Gelen var mı?</span>
          </p>

          <footer className="mt-4 flex flex-col items-start gap-2.5 border-t border-[#1c2821]/10 pt-3 text-xs font-semibold text-[#1c2821]/66 dark:border-white/10 dark:text-[#ece8e1]/64 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="size-4"
                >
                  <path
                    d="M10 16.2s-6-3.4-6-8.1A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.1c0 4.7-6 8.1-6 8.1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                Beğen
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="size-4"
                >
                  <path
                    d="M16.3 9.1c0 3.4-2.8 6-6.3 6a7 7 0 0 1-2.3-.4L4 16l1.1-3A5.8 5.8 0 0 1 3.7 9.1c0-3.4 2.8-6.1 6.3-6.1s6.3 2.7 6.3 6.1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                Yanıtla
              </span>
            </div>
            <span className="max-w-full font-mono text-[8px] uppercase leading-4 tracking-[0.1em]">
              Diğer öğrenciler adını görmez
            </span>
          </footer>
        </article>

        <div className="grid gap-2.5 min-[420px]:grid-cols-2 sm:gap-4">
          <article className="feed-item flex min-h-32 flex-col rounded-[1.1rem] border border-[#1c2821]/12 bg-[#e1d5ca] p-3 dark:border-white/10 dark:bg-[#30231f] sm:min-h-40 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#883225] dark:text-[#d09272]">
                Etkinlik
              </span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#1c2821]/62 dark:text-[#ece8e1]/58">
                Bu hafta
              </span>
            </div>

            <div className="mt-auto pt-5 sm:pt-7">
              <h3 className="text-base font-black leading-5 tracking-[-0.035em]">
                Kulüpler Tanışma Günü
              </h3>
              <p className="mt-2 text-[11px] leading-4 text-[#1c2821]/60 dark:text-[#ece8e1]/60">
                Selçuk Yaşar Kampüsü · Detaylara bak
              </p>
            </div>
          </article>

          <article className="feed-item flex min-h-32 flex-col rounded-[1.1rem] border border-[#1c2821]/12 bg-[#dedde4] p-3 dark:border-white/10 dark:bg-[#25252d] sm:min-h-40 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#5b477a] dark:text-[#aaa6ba]">
                Topluluk
              </span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#1c2821]/62 dark:text-[#ece8e1]/58">
                Yeni
              </span>
            </div>

            <div className="mt-auto pt-5 sm:pt-7">
              <h3 className="text-base font-black leading-5 tracking-[-0.035em]">
                Frontend Çalışma Grubu
              </h3>
              <p className="mt-2 text-[11px] leading-4 text-[#1c2821]/60 dark:text-[#ece8e1]/60">
                Birlikte öğren, proje geliştir
              </p>
            </div>
          </article>
        </div>

        <div className="feed-item flex min-w-0 flex-col gap-3 rounded-[1.1rem] bg-[#1c2821] p-3 text-[#fbf8f1] dark:border dark:border-white/8 dark:bg-[#101215] sm:gap-4 sm:p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-[-0.02em]">
              Kampüs akışına katıl
            </p>
            <p className="mt-1 text-[10px] text-[#fbf8f1]/68">
              Yalnızca Yaşar öğrencilerine açık
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            <Link
              href="/giris"
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border border-white/14 px-3 text-center text-[11px] font-bold text-[#fbf8f1]/76 outline-none transition-colors hover:border-white/24 hover:bg-white/7 hover:text-white focus-visible:ring-2 focus-visible:ring-white/45"
            >
              Giriş yap
            </Link>
            <Link
              href="/kayit"
              className="group inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#b8795f] px-3 text-center text-xs font-bold text-[#1c2821] outline-none transition-colors hover:bg-[#c88a6e] focus-visible:ring-3 focus-visible:ring-white/35 dark:bg-[#c7896d] dark:text-[#151319] dark:hover:bg-[#d59a7d]"
            >
              Kayıt ol
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                void continueAsGuest();
              }}
              disabled={isOpeningGuestView}
              aria-busy={isOpeningGuestView}
              className="col-span-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/16 bg-white/8 px-4 text-center text-[11px] font-bold text-[#fbf8f1] outline-none transition-colors hover:border-white/28 hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-white/45 disabled:cursor-wait disabled:opacity-65"
            >
              {isOpeningGuestView
                ? "Misafir görünümü açılıyor…"
                : "Misafir olarak giriş yap"}
            </button>
          </div>

          {guestError ? (
            <p
              role="status"
              aria-live="polite"
              className="text-[10px] leading-4 text-[#efb6a6]"
            >
              {guestError}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
