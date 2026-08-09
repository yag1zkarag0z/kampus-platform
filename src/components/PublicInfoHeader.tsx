import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";

export default function PublicInfoHeader() {
  return (
    <header className="border-b border-white/10 bg-canvas text-white">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1180px] items-center justify-between gap-2 px-[16px] sm:min-h-20 sm:gap-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          aria-label="KAMPÜS ana sayfa"
          className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
        >
          <CampusLogo
            idPrefix="info-header-logo"
            wordmarkClassName="text-[18px] sm:text-xl"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-[6px] text-[14px] font-bold sm:gap-2 sm:text-sm">
          <Link
            href="/"
            className="hidden min-h-11 items-center rounded-full px-4 text-white/62 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:inline-flex"
          >
            Ana sayfa
          </Link>
          <Link
            href="/giris"
            className="inline-flex min-h-[44px] items-center rounded-full bg-white px-[16px] whitespace-nowrap text-[#101012] outline-none transition-colors hover:bg-white/88 focus-visible:ring-3 focus-visible:ring-white/35 sm:min-h-11 sm:px-5"
          >
            Giriş yap
          </Link>
        </div>
      </div>
    </header>
  );
}
