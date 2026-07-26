import type { ReactNode } from "react";
import Link from "next/link";
import CampusLogo from "@/components/CampusLogo";
import ThemeToggle from "@/components/ThemeToggle";

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
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#eee9e1] text-[#1c2821] transition-colors dark:bg-[#111315] dark:text-[#ece8e1]">
      <div
        aria-hidden="true"
        className="hero-gradient-motion pointer-events-none absolute inset-0 -z-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[-32%] -z-20 w-[78%] -skew-x-6 bg-[linear-gradient(155deg,rgba(59,32,40,0.15)_0%,rgba(154,89,68,0.12)_42%,rgba(119,116,138,0.13)_70%,transparent_92%)] dark:opacity-70 sm:right-[-20%] sm:w-[64%] lg:right-[-8%] lg:w-[48%]"
      />
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto flex min-h-svh w-full max-w-[1360px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-[4.5rem] items-center justify-between border-b border-[#1c2821]/14 dark:border-white/12 sm:min-h-20">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] focus-visible:ring-offset-4 focus-visible:ring-offset-[#eee9e1] dark:focus-visible:ring-[#ece8e1] dark:focus-visible:ring-offset-[#111315]"
          >
            <CampusLogo
              idPrefix={`auth-${mode}-logo`}
              wordmarkClassName="text-lg sm:text-xl"
            />
          </Link>

          <ThemeToggle className="size-11 px-0" />
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,0.78fr)] lg:gap-16 lg:py-16 xl:gap-24">
          <section className="max-w-2xl">
            <h1 className="max-w-3xl text-[clamp(2.8rem,9vw,5.6rem)] font-black leading-[0.91] tracking-[-0.06em]">
              {title}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#1c2821]/68 dark:text-[#ece8e1]/68 sm:text-lg sm:leading-8">
              {description}
            </p>

            <aside className="mt-7 max-w-xl border-l-2 border-[#9a5944] pl-3 text-[11px] leading-5 text-[#1c2821]/62 dark:border-[#c7896d] dark:text-[#ece8e1]/58 sm:text-xs">
              KAMPÜS bağımsız bir öğrenci projesidir;{" "}
              <strong className="font-bold text-[#7d3c2d] dark:text-[#d09272]">
                Yaşar Üniversitesi’nin resmî platformu değildir.
              </strong>
            </aside>
          </section>

          <section
            aria-label={mode === "register" ? "Kayıt formu" : "Giriş formu"}
            className="w-full lg:justify-self-end"
          >
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
