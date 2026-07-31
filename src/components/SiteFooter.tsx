import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";
import HeroParticles, {
  createHeroParticles,
} from "@/components/HeroParticles";

const footerParticles = createHeroParticles(18, 0x1c2821);

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#fbf8f1] text-[#1c2821] dark:bg-[#0a0d16] dark:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(ellipse_90%_120%_at_15%_0%,rgba(255,122,69,0.1)_0%,transparent_55%)]"
      />

      <div className="hidden dark:block">
        <HeroParticles particles={footerParticles} />
      </div>

      <div className="relative mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 w-fit items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:focus-visible:ring-white"
          >
            <CampusLogo
              idPrefix="footer-logo"
              wordmarkClassName="text-xl"
            />
          </Link>

          <nav
            aria-label="Alt menü"
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-[#1c2821]/65 dark:text-white/65"
          >
            <Link
              href="/#kampus-nabzi"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#ff7a45] dark:focus-visible:ring-white"
            >
              Kampüs Nabzı
            </Link>
            <Link
              href="/#nasil-calisir"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#ff7a45] dark:focus-visible:ring-white"
            >
              Nasıl çalışır?
            </Link>
            <Link
              href="/#guvenlik"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#ff7a45] dark:focus-visible:ring-white"
            >
              Güvenlik
            </Link>
            <Link
              href="/sozlesme"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#ff7a45] dark:focus-visible:ring-white"
            >
              Kullanım Sözleşmesi
            </Link>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-[#1c2821]/12 pt-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <p className="max-w-3xl text-[11px] leading-5 text-[#1c2821]/65 dark:text-white/65 sm:text-xs">
            KAMPÜS bağımsız bir öğrenci projesidir.{" "}
            <strong className="font-bold text-[#8f3427] dark:text-[#ff7a45]">
              Yaşar Üniversitesi’nin resmî platformu değildir.
            </strong>{" "}
            Üniversite tarafından işletilmez veya desteklenmez.
          </p>

          <p className="shrink-0 text-[11px] leading-5 text-[#1c2821]/60 dark:text-white/60 sm:text-xs lg:text-right">
            © 2026 KAMPÜS. //
            <span className="font-bold text-[#1c2821] dark:text-white">Yağız Karagöz</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
