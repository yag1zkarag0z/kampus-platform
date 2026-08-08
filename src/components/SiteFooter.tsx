import Link from "next/link";

import CampusLogo from "@/components/CampusLogo";
import styles from "./SiteFooter.module.css";

const footerLinks = [
  { href: "/#kampus-nabzi", label: "Özellikler" },
  { href: "/nasil-calisir", label: "Nasıl çalışır?" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/sss", label: "SSS" },
  { href: "/sozlesme", label: "Kullanım sözleşmesi" },
];

const independenceNotice =
  "Bağımsız öğrenci projesi. Yaşar Üniversitesi’nin resmî platformu değildir.";

export default function SiteFooter() {
  return (
    <footer className="bg-canvas text-white">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
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
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-white/52"
          >
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="outline-none transition-colors hover:text-white focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-[11px] leading-5 text-white/38 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <p className={`${styles.independenceNotice} max-w-2xl`}>
            {independenceNotice}
          </p>
          <p className="flex shrink-0 items-center gap-1.5 text-white/38">
            <span>© 2026 KAMPÜS</span>
            <span aria-hidden="true" className="text-white/20">
              ·
            </span>
            <a
              href="https://www.yagizkaragoz.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Yağız Karagöz kişisel web sitesi (yeni sekmede açılır)"
              className={styles.signatureLink}
            >
              <span>Yağız Karagöz</span>
              <span aria-hidden="true" className={styles.signatureArrow}>
                ↗
              </span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
