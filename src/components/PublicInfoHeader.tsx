import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";

export default function PublicInfoHeader() {
  return (
    <header className="border-b border-white/10 bg-canvas text-white">
      <div className="mx-auto flex min-h-20 w-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          aria-label="KAMPÜS ana sayfa"
          className="inline-flex min-h-11 items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
        >
          <CampusLogo
            idPrefix="info-header-logo"
            wordmarkClassName="text-xl"
          />
        </Link>

        <div className="flex items-center gap-2 text-sm font-bold">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-white/62 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:px-4"
          >
            Ana sayfa
          </Link>
          <Link
            href="/giris"
            className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[#101012] outline-none transition-colors hover:bg-white/88 focus-visible:ring-3 focus-visible:ring-white/35 sm:px-5"
          >
            Giriş yap
          </Link>
        </div>
      </div>
    </header>
  );
}
