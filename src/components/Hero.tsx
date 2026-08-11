import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";
import GuestEntryButton from "@/components/GuestEntryButton";
import HomepageTrackedLink from "@/components/HomepageTrackedLink";

const navItems = [
  { href: "/nasil-calisir", label: "Nasıl çalışır?" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/sss", label: "SSS" },
];

export default function Hero() {
  return (
    <section className="bg-canvas text-white">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-10 2xl:max-w-[1480px]">
        <header className="flex min-h-18 items-center justify-between border-b border-white/8 xl:min-h-20 2xl:min-h-[88px]">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white xl:min-h-12 2xl:min-h-[52px]"
          >
            <CampusLogo
              idPrefix="hero-logo"
              wordmarkClassName="text-xl xl:text-[22px] 2xl:text-2xl"
            />
          </Link>

          <nav
            aria-label="Ana menü"
            className="hidden items-center gap-7 text-[13px] font-semibold text-white/68 md:flex xl:gap-8 xl:text-[14px] 2xl:gap-9 2xl:text-[15px]"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center outline-none transition-colors hover:text-white focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white xl:min-h-12 2xl:min-h-[52px]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-sm font-bold xl:gap-3 xl:text-[15px] 2xl:text-[16px]">
            <HomepageTrackedLink
              href="/giris"
              source="header_login"
              target="login"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-white/72 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:px-4 xl:min-h-12 xl:px-5 2xl:min-h-[52px] 2xl:px-6"
            >
              Giriş yap
            </HomepageTrackedLink>
            <HomepageTrackedLink
              href="/kayit"
              source="header_register"
              target="register"
              className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[#101012] outline-none transition-colors hover:bg-white/88 focus-visible:ring-3 focus-visible:ring-white/35 sm:px-5 xl:min-h-12 xl:px-6 2xl:min-h-[52px] 2xl:px-7"
            >
              Kayıt ol
            </HomepageTrackedLink>
          </div>
        </header>

        <div className="mx-auto flex max-w-4xl flex-col items-center px-2 pb-12 pt-16 text-center sm:pb-14 sm:pt-20 lg:pb-16 lg:pt-24">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-white/58 sm:text-[11px]">
            Bağımsız öğrenci ağı
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
          </p>
          <h1 className="text-[clamp(3.15rem,7.8vw,6.45rem)] font-semibold leading-[0.95] tracking-[-0.06em]">
            Yaşar kampüsü,
            <span className="block">
              tek akışta<span className="text-brand">.</span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-white/58 sm:text-lg">
            Paylaş, keşfet, bağlantı kur.
          </p>

          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <GuestEntryButton
              analyticsSource="hero_guest"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-white/88 focus-visible:ring-3 focus-visible:ring-white/35 disabled:cursor-wait disabled:opacity-65"
            >
              Misafir olarak göz at
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </GuestEntryButton>
            <HomepageTrackedLink
              href="/kayit"
              source="hero_register"
              target="register"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/14 px-6 text-sm font-bold text-white outline-none transition-colors hover:border-white/28 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white"
            >
              Kayıt ol
            </HomepageTrackedLink>
          </div>

          <p className="mt-4 text-xs leading-5 text-white/42 sm:text-[13px]">
            Kayıt için{" "}
            <strong className="font-semibold text-white/62">
              @stu.yasar.edu.tr
            </strong>{" "}
            adresin gerekir.
          </p>
        </div>
      </div>
    </section>
  );
}
