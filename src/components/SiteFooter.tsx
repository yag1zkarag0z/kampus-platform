import CampusLogo from "@/components/CampusLogo";

export default function SiteFooter() {
  return (
    <footer className="bg-[#fbf8f1] text-[#1c2821] dark:bg-[#121417] dark:text-[#ece8e1]">
      <div className="mx-auto w-full max-w-[1360px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="#"
            aria-label="KAMPÜS ana sayfa"
            className="inline-flex min-h-11 w-fit items-center outline-none transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:focus-visible:ring-white"
          >
            <CampusLogo
              idPrefix="footer-logo"
              wordmarkClassName="text-xl"
            />
          </a>

          <nav
            aria-label="Alt menü"
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-[#1c2821]/65 dark:text-white/65"
          >
            <a
              href="#kampus-nabzi"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#c7896d] dark:focus-visible:ring-white"
            >
              Kampüs Nabzı
            </a>
            <a
              href="#nasil-calisir"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#c7896d] dark:focus-visible:ring-white"
            >
              Nasıl çalışır?
            </a>
            <a
              href="#guvenlik"
              className="outline-none transition-colors hover:text-[#a83d2d] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#1c2821] dark:hover:text-[#c7896d] dark:focus-visible:ring-white"
            >
              Güvenlik
            </a>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-[#1c2821]/12 pt-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <p className="max-w-3xl text-[11px] leading-5 text-[#1c2821]/65 dark:text-white/65 sm:text-xs">
            KAMPÜS bağımsız bir öğrenci projesidir.{" "}
            <strong className="font-bold text-[#8f3427] dark:text-[#c7896d]">
              Yaşar Üniversitesi’nin resmî platformu değildir.
            </strong>{" "}
            Üniversite tarafından işletilmez veya desteklenmez.
          </p>

          <p className="shrink-0 text-[11px] leading-5 text-[#1c2821]/60 dark:text-white/60 sm:text-xs lg:text-right">
            © 2026 KAMPÜS. Tasarım ve geliştirme:{" "}
            <span className="font-bold text-[#1c2821] dark:text-[#ece8e1]">Yağız Karagöz</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
