import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";
import HeroParticles, {
  createHeroParticles,
} from "@/components/HeroParticles";

const footerParticles = createHeroParticles(18, 0x1c2821);

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0a0d16] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_120%_at_15%_0%,rgba(255,122,69,0.1)_0%,transparent_55%)]"
      />

      <HeroParticles particles={footerParticles} />

      <div className="relative mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 w-fit items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white"
          >
            <CampusLogo
              idPrefix="footer-logo"
              wordmarkClassName="text-xl"
            />
          </Link>

          <nav
            aria-label="Alt menü"
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-white/65"
          >
            <Link
              href="/#kampus-nabzi"
              className="outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              Kampüs Nabzı
            </Link>
            <Link
              href="/#nasil-calisir"
              className="outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              Nasıl çalışır?
            </Link>
            <Link
              href="/#guvenlik"
              className="outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              Güvenlik
            </Link>
            <Link
              href="/#sss"
              className="outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              SSS
            </Link>
            <Link
              href="/sozlesme"
              className="outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              Kullanım Sözleşmesi
            </Link>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <p className="max-w-3xl text-[11px] leading-5 text-white/65 sm:text-xs">
            KAMPÜS bağımsız bir öğrenci projesidir.{" "}
            <strong className="font-bold text-[#ff7a45]">
              Yaşar Üniversitesi’nin resmî platformu değildir.
            </strong>{" "}
            Üniversite tarafından işletilmez veya desteklenmez.
          </p>

          <p className="shrink-0 text-[11px] leading-5 text-white/60 sm:text-xs lg:text-right">
            © 2026 KAMPÜS. //{" "}
            <a
              href="https://www.yagizkaragoz.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white outline-none transition-colors hover:text-[#ff7a45] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
            >
              Yağız Karagöz
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
