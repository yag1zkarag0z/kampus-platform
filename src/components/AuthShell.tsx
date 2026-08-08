import type { ReactNode } from "react";
import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";

type AuthShellProps = {
  mode: "login" | "register";
  title: ReactNode;
  description: string;
  children: ReactNode;
};

export default function AuthShell({
  mode,
  title,
  description,
  children,
}: AuthShellProps) {
  const isLogin = mode === "login";

  return (
    <main className="min-h-svh bg-canvas text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1180px] flex-col px-5 sm:px-8 lg:px-10">
        <header className="flex min-h-18 items-center justify-between gap-4 border-b border-white/8">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
          >
            <CampusLogo
              idPrefix={`auth-${mode}-logo`}
              wordmarkClassName="text-xl"
            />
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="hidden text-[13px] font-normal text-white/42 sm:inline">
              {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}
            </span>
            <Link
              href={isLogin ? "/kayit" : "/giris"}
              className="inline-flex min-h-10 items-center rounded-lg border border-white/12 bg-white/[0.035] px-3.5 text-[14px] font-medium tracking-normal text-white/82 outline-none transition-colors hover:border-white/22 hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              {isLogin ? "Kayıt ol" : "Giriş yap"}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-start justify-center py-8 sm:py-12 lg:py-14">
          <div
            className={`w-full ${
              isLogin ? "max-w-[31rem]" : "max-w-[34rem]"
            }`}
          >
            <section className="mb-7 text-center sm:mb-8">
              <h1 className="text-[clamp(2.7rem,6.8vw,4.55rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
                {title}
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/52 sm:text-base">
                {description}
              </p>
            </section>

            <section
              aria-label={isLogin ? "Giriş formu" : "Kayıt formu"}
            >
              {children}
            </section>

            <p className="mx-auto mt-6 max-w-xl text-center text-[11px] leading-5 text-white/30">
              Bağımsız öğrenci projesi · Yaşar Üniversitesi’nin resmî platformu değildir.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
