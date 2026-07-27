"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusLogo from "@/components/CampusLogo";
import ThemeToggle from "@/components/ThemeToggle";

type NavigationIconName =
  | "feed"
  | "discover"
  | "share"
  | "notifications"
  | "saved"
  | "profile";

type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIconName;
  primary?: boolean;
};

const navigationItems: readonly NavigationItem[] = [
  { href: "/akis", label: "Akış", icon: "feed" },
  { href: "/kesfet", label: "Keşfet", icon: "discover" },
  {
    href: "/bildirimler",
    label: "Bildirimler",
    icon: "notifications",
  },
  { href: "/kaydedilenler", label: "Kaydedilenler", icon: "saved" },
  { href: "/profil", label: "Profil", icon: "profile" },
];

const mobileNavigationItems: readonly NavigationItem[] = [
  { href: "/akis", label: "Akış", icon: "feed" },
  { href: "/kesfet", label: "Keşfet", icon: "discover" },
  { href: "/konu-olustur", label: "Konu", icon: "share", primary: true },
  {
    href: "/bildirimler",
    label: "Bildirim",
    icon: "notifications",
  },
  { href: "/profil", label: "Profil", icon: "profile" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationIconGlyph({ name }: { name: NavigationIconName }) {
  switch (name) {
    case "feed":
      return (
        <>
          <path d="M4 6.5h16M4 12h16M4 17.5h10" />
          <circle cx="18" cy="17.5" r="2" />
        </>
      );
    case "discover":
      return (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7 4.7-2.1Z" />
        </>
      );
    case "share":
      return <path d="M12 5v14M5 12h14" />;
    case "notifications":
      return (
        <>
          <path d="M6.7 10.3a5.3 5.3 0 0 1 10.6 0c0 5 2 5.4 2 6.5H4.7c0-1.1 2-1.5 2-6.5Z" />
          <path d="M9.5 19a2.8 2.8 0 0 0 5 0" />
        </>
      );
    case "saved":
      return <path d="M6.2 4.2h11.6v15.6L12 16.4l-5.8 3.4V4.2Z" />;
    case "profile":
      return (
        <>
          <circle cx="12" cy="8.2" r="3.3" />
          <path d="M5.2 19.5c.7-3.6 3.1-5.5 6.8-5.5s6.1 1.9 6.8 5.5" />
        </>
      );
  }
}

function NavigationIcon({
  name,
  className = "size-5",
}: {
  name: NavigationIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <NavigationIconGlyph name={name} />
    </svg>
  );
}

function ShareIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useCampusAccount();
  const [isDesktopNavigationOpen, setIsDesktopNavigationOpen] =
    useState(false);

  useEffect(() => {
    if (!isDesktopNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDesktopNavigationOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isDesktopNavigationOpen]);

  const handleSignOut = () => {
    setIsDesktopNavigationOpen(false);
    signOut();
    router.replace("/giris");
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-[#1c2821]/12 bg-[#fbf8f1]/95 px-3 py-2 text-[#1c2821] shadow-[0_10px_32px_rgba(28,40,33,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-[#121417]/95 dark:text-[#ece8e1] dark:shadow-[0_10px_32px_rgba(0,0,0,0.2)] md:hidden">
        <Link
          href="/akis"
          aria-label="KAMPÜS akışına git"
          className="inline-flex min-h-11 items-center rounded-lg px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40"
        >
          <CampusLogo
            idPrefix="mobile-app-navigation-logo"
            wordmarkClassName="text-lg"
          />
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/kaydedilenler"
            aria-label="Kaydedilen konuları aç"
            aria-current={
              isActivePath(pathname, "/kaydedilenler") ? "page" : undefined
            }
            className={`grid size-11 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 ${
              isActivePath(pathname, "/kaydedilenler")
                ? "bg-[#5a2538]/10 text-[#5a2538] dark:bg-[#c7896d]/12 dark:text-[#d09272]"
                : "text-[#1c2821]/62 hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
            }`}
          >
            <NavigationIcon name="saved" className="size-[1.15rem]" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <header className="fixed left-3 top-2 z-[70] hidden h-12 items-center gap-1 bg-transparent text-[#1c2821] md:flex dark:text-[#ece8e1]">
        <button
          type="button"
          aria-label={
            isDesktopNavigationOpen
              ? "Masaüstü menüsünü kapat"
              : "Masaüstü menüsünü aç"
          }
          aria-expanded={isDesktopNavigationOpen}
          aria-controls="desktop-app-navigation"
          onClick={() =>
            setIsDesktopNavigationOpen((current) => !current)
          }
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-[#1c2821]/7 focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:hover:bg-white/8 dark:focus-visible:ring-[#c7896d]/40"
        >
          <span aria-hidden="true" className="grid gap-1">
            <span className="block h-px w-5 rounded-full bg-current" />
            <span className="block h-px w-5 rounded-full bg-current" />
            <span className="block h-px w-5 rounded-full bg-current" />
          </span>
        </button>

        <Link
          href="/akis"
          aria-label="KAMPÜS akışına git"
          onClick={() => setIsDesktopNavigationOpen(false)}
          className="inline-flex min-h-11 items-center rounded-xl px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40"
        >
          <CampusLogo
            idPrefix="desktop-app-navigation-logo"
            wordmarkClassName="text-xl"
          />
        </Link>
      </header>

      <button
        type="button"
        aria-label="Masaüstü menüsünü kapat"
        aria-hidden={!isDesktopNavigationOpen}
        tabIndex={isDesktopNavigationOpen ? 0 : -1}
        onClick={() => setIsDesktopNavigationOpen(false)}
        className={`fixed inset-0 z-40 hidden cursor-default bg-[#101113]/30 transition-opacity duration-200 motion-reduce:transition-none md:block dark:bg-black/45 ${
          isDesktopNavigationOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="desktop-app-navigation"
        aria-label="Masaüstü uygulama menüsü"
        aria-hidden={!isDesktopNavigationOpen}
        inert={!isDesktopNavigationOpen}
        className={`fixed inset-y-0 left-0 z-50 hidden w-24 overflow-hidden border-r border-[#1c2821]/12 bg-[#fbf8f1]/98 pt-20 text-[#1c2821] shadow-[12px_0_36px_rgba(28,40,33,0.14)] backdrop-blur-xl transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-white/10 dark:bg-[#121417]/98 dark:text-[#ece8e1] dark:shadow-[12px_0_38px_rgba(0,0,0,0.34)] md:flex ${
          isDesktopNavigationOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto px-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav aria-label="Uygulama menüsü">
            <ul className="grid gap-1">
              {navigationItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      title={item.label}
                      onClick={() => setIsDesktopNavigationOpen(false)}
                      className={`group relative flex min-h-[4.35rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-[10px] font-black leading-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 ${
                        isActive
                          ? "bg-[#5a2538]/11 text-[#5a2538] dark:bg-[#c7896d]/13 dark:text-[#d09272]"
                          : "text-[#1c2821]/66 hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-white/62 dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
                      }`}
                    >
                      <NavigationIcon
                        name={item.icon}
                        className="size-[1.35rem] shrink-0"
                      />
                      <span className="max-w-full truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link
            href="/konu-olustur"
            aria-label="Yeni konu aç"
            aria-current={
              isActivePath(pathname, "/konu-olustur") ? "page" : undefined
            }
            title="Konu aç"
            onClick={() => setIsDesktopNavigationOpen(false)}
            className="mt-2 inline-flex min-h-[4.35rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-[#1c2821] px-1 text-[10px] font-black leading-none text-[#fbf8f1] shadow-[0_8px_20px_rgba(28,40,33,0.14)] outline-none transition-colors hover:bg-[#5a2538] focus-visible:ring-3 focus-visible:ring-[#5a2538]/30 dark:bg-[#c7896d] dark:text-[#121417] dark:shadow-none dark:hover:bg-[#d09272] dark:focus-visible:ring-[#c7896d]/45"
          >
            <ShareIcon className="size-[1.35rem] shrink-0" />
            <span>Konu aç</span>
          </Link>

          <div className="mt-auto grid gap-1 border-t border-[#1c2821]/10 pt-3 dark:border-white/10">
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Çıkış yap"
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-1 text-[10px] font-black text-[#7f302b] outline-none transition-colors hover:bg-[#8b2f2a]/7 focus-visible:ring-3 focus-visible:ring-[#8b2f2a]/25 dark:text-[#e18a7d] dark:hover:bg-[#d27368]/9 dark:focus-visible:ring-[#d27368]/35"
            >
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      <nav
        aria-label="Mobil uygulama menüsü"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1c2821]/12 bg-[#fbf8f1]/96 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[#1c2821] shadow-[0_-12px_34px_rgba(28,40,33,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#121417]/96 dark:text-[#ece8e1] dark:shadow-[0_-12px_34px_rgba(0,0,0,0.24)] md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {mobileNavigationItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    item.primary ? "Yeni konu aç" : undefined
                  }
                  className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold leading-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 ${
                    item.primary
                      ? "text-[#5a2538] dark:text-[#d09272]"
                      : isActive
                        ? "bg-[#5a2538]/10 text-[#5a2538] dark:bg-[#c7896d]/12 dark:text-[#d09272]"
                        : "text-[#1c2821]/60 hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
                  }`}
                >
                  <span
                    className={
                      item.primary
                        ? "grid size-8 -translate-y-1 place-items-center rounded-full bg-[#5a2538] text-[#fbf8f1] shadow-[0_7px_18px_rgba(90,37,56,0.24)] dark:bg-[#c7896d] dark:text-[#121417] dark:shadow-none"
                        : undefined
                    }
                  >
                    <NavigationIcon
                      name={item.icon}
                      className={
                        item.primary
                          ? "size-[1.05rem] shrink-0"
                          : "size-[1.15rem] shrink-0"
                      }
                    />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
