"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusLogo from "@/components/CampusLogo";
import { useCampusNotificationStore } from "@/components/CampusNotificationStore";
import { useFeedback } from "@/components/FeedbackProvider";
import ThemeToggle from "@/components/ThemeToggle";

type NavigationIconName =
  | "feed"
  | "discover"
  | "share"
  | "notifications"
  | "saved"
  | "profile"
  | "admin";

type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIconName;
  primary?: boolean;
  privilegedOnly?: boolean;
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
  {
    href: "/admin",
    label: "Yönetim",
    icon: "admin",
    privilegedOnly: true,
  },
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

function isGuestProtectedPath(href: string) {
  return href === "/konu-olustur";
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
    case "admin":
      return (
        <>
          <path d="M12 3.5 19 6v5.2c0 4.3-2.7 7.7-7 9.3-4.3-1.6-7-5-7-9.3V6l7-2.5Z" />
          <path d="m9.2 12 1.8 1.8 3.9-4" />
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

function NotificationBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a63f32] px-1 font-mono text-[8px] font-black leading-none text-white ring-2 ring-[#f8f4ed] dark:bg-[#e18a70] dark:text-[#121417] dark:ring-[#141619]"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, isGuest, role } = useCampusAccount();
  const {
    isHydrated: areNotificationsHydrated,
    unreadCount,
  } = useCampusNotificationStore();
  const { confirm: confirmAction, showToast } = useFeedback();
  const [isDesktopNavigationOpen, setIsDesktopNavigationOpen] =
    useState(true);

  useEffect(() => {
    if (!isDesktopNavigationOpen) {
      return;
    }

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDesktopNavigationOpen(false);
      }
    };

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isDesktopNavigationOpen]);

  const handleSignOut = async () => {
    const confirmed = await confirmAction({
      title: isGuest
        ? "Misafir görünümünden çıkmak istiyor musun?"
        : "Çıkış yapmak istiyor musun?",
      description: isGuest
        ? "Giriş ekranına döneceksin."
        : "Profilin ve gönderilerin bu cihazda kalır. Yalnızca oturumun kapanır.",
      confirmLabel: "Çıkış yap",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsDesktopNavigationOpen(false);
    try {
      await signOut();
      router.replace("/giris");
    } catch {
      showToast({
        message: "Çıkış yapılamadı. İnternet bağlantını kontrol edip yeniden dene.",
        tone: "error",
      });
    }
  };

  const showGuestAuthToast = () => {
    showToast({
      message: "Bu özellik için giriş yap veya kayıt ol.",
      tone: "info",
      action: {
        label: "Giriş yap",
        onClick: () => router.push("/giris"),
      },
    });
  };

  const handleGuestProtectedNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    if (!isGuest) {
      return;
    }

    event.preventDefault();
    showGuestAuthToast();
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
          {!isGuest && role !== "member" && (
            <Link
              href="/admin"
              aria-label="Yönetim panelini aç"
              aria-current={
                isActivePath(pathname, "/admin") ? "page" : undefined
              }
              className={`grid size-11 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 ${
                isActivePath(pathname, "/admin")
                  ? "bg-[#5a2538]/10 text-[#5a2538] dark:bg-[#c7896d]/12 dark:text-[#d09272]"
                  : "text-[#58635c] hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
              }`}
            >
              <NavigationIcon name="admin" className="size-[1.15rem]" />
            </Link>
          )}
          <Link
            href="/kaydedilenler"
            aria-label="Kaydedilen konuları aç"
            aria-current={
              isActivePath(pathname, "/kaydedilenler")
                ? "page"
                : undefined
            }
            className={`grid size-11 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 ${
              isActivePath(pathname, "/kaydedilenler")
                ? "bg-[#5a2538]/10 text-[#5a2538] dark:bg-[#c7896d]/12 dark:text-[#d09272]"
                : "text-[#1c2821]/62 hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
            }`}
          >
            <NavigationIcon name="saved" className="size-[1.15rem]" />
          </Link>
          {isGuest && (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-black text-[#7f302b] outline-none transition-colors hover:bg-[#8b2f2a]/7 focus-visible:ring-3 focus-visible:ring-[#8b2f2a]/25 dark:text-[#e18a7d] dark:hover:bg-[#d27368]/9 dark:focus-visible:ring-[#d27368]/35"
            >
              Çıkış
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-40 hidden min-w-0 text-[#1c2821] md:col-start-1 md:row-start-1 md:flex md:justify-end dark:text-[#ece8e1]">
        <div className="sticky top-0 flex h-svh min-h-0 w-full max-w-[15rem] flex-col items-center px-2 py-2 xl:items-stretch xl:px-3">
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
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-[#1c2821]/7 focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:hover:bg-white/8 dark:focus-visible:ring-[#c7896d]/40 xl:self-start"
          >
            <span aria-hidden="true" className="relative block size-5">
              <span
                className={`absolute left-0 top-1 block h-px w-5 rounded-full bg-current transition-transform duration-200 motion-reduce:transition-none ${
                  isDesktopNavigationOpen
                    ? "translate-y-1.5 rotate-45"
                    : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2.5 block h-px w-5 rounded-full bg-current transition-opacity duration-200 motion-reduce:transition-none ${
                  isDesktopNavigationOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-4 block h-px w-5 rounded-full bg-current transition-transform duration-200 motion-reduce:transition-none ${
                  isDesktopNavigationOpen
                    ? "-translate-y-1.5 -rotate-45"
                    : ""
                }`}
              />
            </span>
          </button>

          <aside
            id="desktop-app-navigation"
            aria-label="Masaüstü uygulama menüsü"
            aria-hidden={!isDesktopNavigationOpen}
            inert={!isDesktopNavigationOpen}
            className={`mt-1 flex min-h-0 w-full flex-1 overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
              isDesktopNavigationOpen
                ? "visible translate-x-0 opacity-100"
                : "pointer-events-none invisible -translate-x-2 opacity-0"
            }`}
          >
            <div className="flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                href="/akis"
                aria-label="KAMPÜS akışına git"
                className="mb-2 flex min-h-12 items-center justify-center rounded-xl outline-none transition-colors hover:bg-[#1c2821]/6 focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:hover:bg-white/7 dark:focus-visible:ring-[#c7896d]/40 xl:justify-start xl:px-3"
              >
                <CampusLogo
                  variant="mark"
                  idPrefix="desktop-app-navigation-logo"
                  markClassName="h-8 w-6"
                  className="xl:hidden"
                />
                <CampusLogo
                  idPrefix="desktop-app-navigation-lockup"
                  className="hidden xl:inline-flex"
                  wordmarkClassName="text-xl 2xl:text-2xl"
                />
              </Link>

              <nav aria-label="Uygulama menüsü">
                <ul className="grid gap-1">
                  {navigationItems
                    .filter(
                      (item) =>
                        !item.privilegedOnly ||
                        (!isGuest && role !== "member"),
                    )
                    .map((item) => {
                    const isActive = isActivePath(pathname, item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={
                            isGuest && isGuestProtectedPath(item.href)
                              ? handleGuestProtectedNavigation
                              : undefined
                          }
                          aria-current={isActive ? "page" : undefined}
                          aria-label={
                            item.icon === "notifications" &&
                            areNotificationsHydrated &&
                            unreadCount > 0
                              ? `${item.label}, ${unreadCount} okunmamış bildirim`
                              : undefined
                          }
                          title={item.label}
                          className={`group relative flex min-h-[4.1rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-[10px] font-black leading-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[#5a2538]/25 dark:focus-visible:ring-[#c7896d]/40 xl:min-h-12 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-left xl:text-sm ${
                            isActive
                              ? "bg-[#5a2538]/11 text-[#5a2538] dark:bg-[#c7896d]/13 dark:text-[#d09272]"
                              : "text-[#1c2821]/66 hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-white/62 dark:hover:bg-white/8 dark:hover:text-[#ece8e1]"
                          }`}
                        >
                          <span className="relative grid size-[1.35rem] shrink-0 place-items-center">
                            <NavigationIcon
                              name={item.icon}
                              className="size-[1.35rem]"
                            />
                            {item.icon === "notifications" &&
                              areNotificationsHydrated &&
                              unreadCount > 0 && (
                                <NotificationBadge
                                  count={unreadCount}
                                />
                              )}
                          </span>
                          <span className="max-w-full truncate">
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                    })}
                </ul>
              </nav>

              <Link
                href="/konu-olustur"
                onClick={
                  isGuest ? handleGuestProtectedNavigation : undefined
                }
                aria-label="Yeni konu aç"
                aria-current={
                  isActivePath(pathname, "/konu-olustur")
                    ? "page"
                    : undefined
                }
                title="Konu aç"
                className="mt-2 inline-flex min-h-[4.1rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-[#1c2821] px-1 text-[10px] font-black leading-none text-[#fbf8f1] shadow-[0_8px_20px_rgba(28,40,33,0.14)] outline-none transition-colors hover:bg-[#5a2538] focus-visible:ring-3 focus-visible:ring-[#5a2538]/30 dark:bg-[#c7896d] dark:text-[#121417] dark:shadow-none dark:hover:bg-[#d09272] dark:focus-visible:ring-[#c7896d]/45 xl:min-h-12 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-sm"
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
        </div>
      </div>

      <nav
        aria-label="Mobil uygulama menüsü"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1c2821]/12 bg-[#fbf8f1]/96 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[#1c2821] shadow-[0_-12px_34px_rgba(28,40,33,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#121417]/96 dark:text-[#ece8e1] dark:shadow-[0_-12px_34px_rgba(0,0,0,0.24)] md:hidden"
      >
        <ul
          className="mx-auto grid max-w-lg grid-cols-5 gap-1"
        >
          {mobileNavigationItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  onClick={
                    isGuest && isGuestProtectedPath(item.href)
                      ? handleGuestProtectedNavigation
                      : undefined
                  }
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    item.primary
                      ? "Yeni konu aç"
                      : item.icon === "notifications" &&
                          areNotificationsHydrated &&
                          unreadCount > 0
                        ? `${item.label}, ${unreadCount} okunmamış bildirim`
                        : undefined
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
                        ? "relative grid size-8 -translate-y-1 place-items-center rounded-full bg-[#5a2538] text-[#fbf8f1] shadow-[0_7px_18px_rgba(90,37,56,0.24)] dark:bg-[#c7896d] dark:text-[#121417] dark:shadow-none"
                        : "relative grid size-8 place-items-center"
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
                    {item.icon === "notifications" &&
                      areNotificationsHydrated &&
                      unreadCount > 0 && (
                        <NotificationBadge count={unreadCount} />
                      )}
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
