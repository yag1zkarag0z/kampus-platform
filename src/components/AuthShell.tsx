import type { ReactNode } from "react";
import Link from "next/link";
import CampusLogo from "@/components/CampusLogo";
import ForceDarkTheme from "@/components/ForceDarkTheme";

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
    <main className="relative isolate min-h-svh overflow-hidden bg-[#0a0d16] text-white">
      <ForceDarkTheme />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_120%_80%_at_82%_-8%,rgba(255,122,69,0.14)_0%,transparent_55%),radial-gradient(ellipse_90%_70%_at_-8%_112%,rgba(94,74,196,0.12)_0%,transparent_58%),linear-gradient(175deg,#05060a_0%,#0a0d16_55%,#0e1220_100%)]"
      />
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto flex min-h-svh w-full max-w-[1360px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-[4.5rem] items-center border-b border-white/10 sm:min-h-20">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0d16]"
          >
            <CampusLogo
              idPrefix={`auth-${mode}-logo`}
              wordmarkClassName="text-lg sm:text-xl"
            />
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,0.78fr)] lg:gap-16 lg:py-16 xl:gap-24">
          <section className="max-w-2xl">
            <h1 className="max-w-3xl text-[clamp(2.8rem,9vw,5.6rem)] font-black leading-[0.91] tracking-[-0.06em]">
              {title}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
              {description}
            </p>

            <aside className="mt-7 max-w-xl border-l-2 border-[#ff7a45] pl-3 text-[11px] leading-5 text-white/62 sm:text-xs">
              KAMPÜS bağımsız bir öğrenci projesidir;{" "}
              <strong className="font-bold text-[#ff7a45]">
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
