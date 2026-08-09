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
    <main className="min-h-svh overflow-x-clip bg-canvas text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1180px] flex-col sm:px-[32px] lg:px-[40px]">
        <header className="flex min-h-[64px] items-center justify-between gap-[12px] border-b border-white/8 px-[16px] sm:min-h-[72px] sm:gap-[16px] sm:px-0">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-[44px] items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
          >
            <CampusLogo
              idPrefix={`auth-${mode}-logo`}
              wordmarkClassName="text-[20px]"
            />
          </Link>

          <div className="flex items-center gap-[10px]">
            <span className="hidden text-[13px] font-normal text-white/42 sm:inline">
              {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}
            </span>
            <Link
              href={isLogin ? "/kayit" : "/giris"}
              className="inline-flex h-[40px] w-[92px] items-center justify-center rounded-[9px] border border-white/12 bg-white/[0.035] px-[10px] text-center text-[14px] font-medium tracking-normal text-white/82 outline-none transition-colors hover:border-white/22 hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              {isLogin ? "Kayıt ol" : "Giriş yap"}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 flex-col sm:items-center sm:justify-center sm:py-[48px] lg:py-[56px]">
          <div className="flex w-full flex-1 flex-col sm:block sm:max-w-[760px]">
            <section className="px-[16px] pt-[26px] pb-[24px] text-center sm:mb-[32px] sm:px-0 sm:pt-0 sm:pb-0">
              <p className="mb-[10px] font-mono text-[10px] font-bold tracking-[0.24em] text-brand uppercase sm:mb-[14px] sm:text-[11px]">
                Yaşar · Bornova
              </p>
              <h1 className="text-[clamp(38px,11vw,48px)] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-[clamp(43px,6vw,64px)] sm:leading-[0.98]">
                {title}
              </h1>
              <p className="mx-auto mt-[12px] max-w-lg text-[15px] leading-[22px] text-white/58 sm:mt-[16px] sm:text-[16px] sm:leading-[24px] sm:text-white/52">
                {description}
              </p>
            </section>

            <section
              aria-label={isLogin ? "Giriş formu" : "Kayıt formu"}
              className="mx-auto flex w-full flex-1 pb-[env(safe-area-inset-bottom)] sm:block sm:max-w-[544px] sm:pb-0 lg:max-w-[720px]"
            >
              {children}
            </section>

            <p className="mx-auto hidden max-w-[576px] text-center text-[11px] leading-[20px] text-white/30 sm:mt-[24px] sm:block">
              Bağımsız öğrenci projesi · Yaşar Üniversitesi’nin resmî platformu değildir.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
