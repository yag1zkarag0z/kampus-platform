"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusLogo from "@/components/CampusLogo";
import { useCampusNotifications } from "@/components/CampusNotificationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import { LOCAL_ACCOUNT_OWNER_ID } from "@/data/campusPosts";

type NavigationIconName =
  | "home"
  | "feed"
  | "discover"
  | "share"
  | "notifications"
  | "saved"
  | "calendar"
  | "profile"
  | "admin"
  | "follow";

type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIconName;
  primary?: boolean;
  privilegedOnly?: boolean;
};

const navigationItems: readonly NavigationItem[] = [
  { href: "/akis", label: "Ana sayfa", icon: "home" },
  { href: "/kesfet", label: "Keşfet", icon: "discover" },
  {
    href: "/bildirimler",
    label: "Bildirimler",
    icon: "notifications",
  },
  { href: "/kaydedilenler", label: "Kaydedilenler", icon: "saved" },
  { href: "/takvim", label: "Kampüs takvimi", icon: "calendar" },
  { href: "/profil", label: "Profil", icon: "profile" },
  {
    href: "/admin",
    label: "Yönetim",
    icon: "admin",
    privilegedOnly: true,
  },
];

const mobileNavigationItems: readonly NavigationItem[] = [
  { href: "/akis", label: "Ana sayfa", icon: "home" },
  { href: "/kesfet", label: "Keşfet", icon: "discover" },
  { href: "/konu-olustur", label: "Konu", icon: "share", primary: true },
  // Bildirimler üst bara (kalp simgesi) taşındı; burada öneriler var.
  { href: "/takip", label: "Öneriler", icon: "follow" },
  // Profil, üst bardaki hesap menüsüne taşındı; alt sırada kaydedilenler var.
  { href: "/kaydedilenler", label: "Kayıtlar", icon: "saved" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGuestProtectedPath(href: string) {
  return href === "/konu-olustur";
}

function NavigationIconGlyph({ name }: { name: NavigationIconName }) {
  switch (name) {
    case "home":
      return (
        <>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 9.8V20h12V9.8" />
          <path d="M10 20v-5.5h4V20" />
        </>
      );
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
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
          <path d="M12 7.5v9M7.5 12h9" />
        </>
      );
    case "notifications":
      // Instagram tarzı kalp: bildirim çanı yerine, akıştaki beğeni
      // ikonuyla aynı aile.
      return (
        <path d="M12 19.4s-7.2-4.3-7.2-9.6a4.2 4.2 0 0 1 7.2-2.9 4.2 4.2 0 0 1 7.2 2.9c0 5.3-7.2 9.6-7.2 9.6Z" />
      );
    case "saved":
      return <path d="M6.2 4.2h11.6v15.6L12 16.4l-5.8 3.4V4.2Z" />;
    case "calendar":
      return (
        <>
          <rect x="3.8" y="5.2" width="16.4" height="15" rx="2" />
          <path d="M3.8 9.8h16.4M8.4 3.5v3.4M15.6 3.5v3.4" />
        </>
      );
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
    case "follow":
      return (
        <>
          <circle cx="9.5" cy="8.3" r="3.2" />
          <path d="M4 19.2c.6-3.7 2.6-5.7 5.5-5.7s4.9 2 5.5 5.7" />
          <path d="M17.5 7.5v5M15 10h5" />
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
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 7.5v9M7.5 12h9" />
    </svg>
  );
}

function SignInIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </svg>
  );
}

// Instagram tarzı: sayı yok, yalnızca "okunmamış var" noktası. Gerçek sayı
// ekran okuyucular için yine de kayboluyor değil — çağıran yerlerdeki
// aria-label'lar unreadCount'u sözel olarak veriyor.
function NotificationBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 size-2.5 animate-[campus-pop_320ms_cubic-bezier(0.16,1,0.3,1)] rounded-full bg-brand ring-2 ring-canvas motion-reduce:animate-none"
    />
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, isGuest, role, profile } = useCampusAccount();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const {
    isUnreadCountHydrated: areNotificationsHydrated,
    unreadCount,
  } = useCampusNotifications();
  const { confirm: confirmAction } = useFeedback();
  const [isDesktopNavigationOpen, setIsDesktopNavigationOpen] =
    useState(true);
  const [signOutStatus, setSignOutStatus] = useActionStatus();
  const [guestNavStatus, setGuestNavStatus] = useActionStatus();
  const [guestNavAnchor, setGuestNavAnchor] = useState<string | null>(null);

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

  // Hesap menüsü dışarı tıklanınca veya Escape ile kapansın.
  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement).closest("[data-account-menu]")
      ) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  // Mobilde aşağı kaydırırken üst bar ve alt menü çekilir, yukarı
  // kaydırınca geri gelir; okuma alanı büyür.
  const [isMobileNavHidden, setIsMobileNavHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const currentY = window.scrollY;
        const delta = currentY - lastY;

        if (Math.abs(delta) > 6) {
          setIsMobileNavHidden(delta > 0 && currentY > 72);
          lastY = currentY;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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
      setSignOutStatus({
        message: "Çıkış yapılamadı. İnternet bağlantını kontrol edip yeniden dene.",
        tone: "error",
      });
    }
  };

  const handleGuestProtectedNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    anchor: string,
  ) => {
    if (!isGuest) {
      return;
    }

    event.preventDefault();
    setGuestNavAnchor(anchor);
    setGuestNavStatus({
      message: "Bu özellik için giriş yap veya kayıt ol.",
      tone: "error",
      action: {
        label: "Giriş yap",
        onClick: () => router.push("/giris"),
      },
    });
  };

  return (
    <>
      {/* Mobil üst bar: solda profil, ortada logo işareti, sağda kısayollar. */}
      <header
        className={`sticky top-0 z-40 grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-white/8 bg-canvas/88 px-3 py-2 text-white backdrop-blur-xl transition-transform duration-300 md:hidden ${
          isMobileNavHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div data-account-menu className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            aria-label="Hesap menüsünü aç"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            className="inline-flex cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-brand/40"
          >
            <CampusAuthorAvatar
              author={`@${profile.username}`}
              authorId={LOCAL_ACCOUNT_OWNER_ID}
              avatarUrl={profile.avatarUrl}
            />
          </button>

          {isAccountMenuOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-surface-raised py-1 shadow-[0_16px_40px_rgba(0,0,0,0.32)]"
            >
              <Link
                href="/profil"
                role="menuitem"
                onClick={() => setIsAccountMenuOpen(false)}
                className="block px-4 py-3 text-sm font-bold outline-none transition-colors hover:bg-white/7"
              >
                Profilim
              </Link>
              {/* Ayarlar gerçek bir hesabı varsayıyor (bildirim tercihi,
                  görünürlük vb.); misafirde bağlanacak gerçek veri yok. */}
              {!isGuest && (
                <Link
                  href="/ayarlar"
                  role="menuitem"
                  onClick={() => setIsAccountMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-bold outline-none transition-colors hover:bg-white/7"
                >
                  Ayarlar
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  handleSignOut();
                }}
                className="block w-full cursor-pointer border-t border-white/8 px-4 py-3 text-left text-sm font-bold text-danger outline-none transition-colors hover:bg-danger/9"
              >
                Çıkış yap
              </button>
            </div>
          )}

          {signOutStatus && (
            <ActionStatusText
              status={signOutStatus}
              className="absolute top-full left-0 z-50 mt-1 w-max max-w-56"
            />
          )}
        </div>

        <Link
          href="/akis"
          aria-label="KAMPÜS akışına git"
          className="justify-self-center rounded-lg px-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-brand/40"
        >
          <CampusLogo
            variant="mark"
            idPrefix="mobile-app-navigation-logo"
            markClassName="h-10 w-8"
          />
        </Link>

        <div className="flex items-center gap-1 justify-self-end">
          {!isGuest && role !== "member" && (
            <Link
              href="/admin"
              aria-label="Yönetim panelini aç"
              aria-current={
                isActivePath(pathname, "/admin") ? "page" : undefined
              }
              className={`grid size-11 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand/40 ${
                isActivePath(pathname, "/admin")
                  ? "bg-brand/12 text-brand"
                  : "text-white/55 hover:bg-white/8 hover:text-white"
              }`}
            >
              <NavigationIcon name="admin" className="size-6" />
            </Link>
          )}
          {/* Öneriler alt menüye taşındı; üst bar Instagram'daki gibi
              bildirimleri kalp simgesiyle taşıyor. */}
          <Link
            href="/bildirimler"
            aria-label={
              areNotificationsHydrated && unreadCount > 0
                ? `Bildirimler, ${unreadCount} okunmamış`
                : "Bildirimleri aç"
            }
            aria-current={
              isActivePath(pathname, "/bildirimler") ? "page" : undefined
            }
            className={`relative grid size-11 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand/40 ${
              isActivePath(pathname, "/bildirimler")
                ? "bg-brand/12 text-brand"
                : "text-white/58 hover:bg-white/8 hover:text-white"
            }`}
          >
            <NavigationIcon name="notifications" className="size-6" />
            {areNotificationsHydrated && unreadCount > 0 && (
              // key={unreadCount}: sayı gerçekten değişince (backend'den
              // geliyor, bkz. CampusNotificationProvider) rozet yeniden
              // takılıp pop animasyonu tekrar oynar.
              <NotificationBadge key={unreadCount} />
            )}
          </Link>
        </div>
      </header>

      <div className="relative z-40 hidden min-w-0 text-white md:col-start-1 md:row-start-1 md:flex md:justify-end">
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
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-white/8 focus-visible:ring-3 focus-visible:ring-brand/40 xl:self-start"
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
                className="mb-2 flex min-h-12 items-center justify-center rounded-xl outline-none transition-colors hover:bg-white/7 focus-visible:ring-3 focus-visible:ring-brand/40 xl:justify-start xl:px-3"
              >
                <span className="xl:hidden">
                  <CampusLogo
                    variant="mark"
                    idPrefix="desktop-app-navigation-logo"
                    markClassName="h-8 w-6"
                  />
                </span>
                <span className="hidden xl:block">
                  <CampusLogo
                    idPrefix="desktop-app-navigation-lockup"
                    wordmarkClassName="text-xl 2xl:text-2xl"
                  />
                </span>
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
                              ? (event) =>
                                  handleGuestProtectedNavigation(
                                    event,
                                    item.href,
                                  )
                              : undefined
                          }
                          aria-current={isActive ? "page" : undefined}
                          aria-label={
                            item.icon === "notifications" &&
                            areNotificationsHydrated &&
                            unreadCount > 0
                              ? `${item.label}, ${unreadCount} okunmamış bildirim`
                              : item.label
                          }
                          title={item.label}
                          className={`group relative flex min-h-14 min-w-0 items-center justify-center rounded-xl px-1 text-center text-[10px] font-bold leading-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand/40 xl:min-h-12 xl:justify-start xl:gap-3 xl:rounded-xl xl:px-3 xl:text-left xl:text-base ${
                            isActive
                              ? "bg-brand/13 text-brand"
                              : "text-white/62 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          <span className="relative grid size-[1.35rem] shrink-0 place-items-center xl:size-7">
                            <NavigationIcon
                              name={item.icon}
                              className="size-[1.35rem] xl:size-7"
                            />
                            {item.icon === "notifications" &&
                              areNotificationsHydrated &&
                              unreadCount > 0 && (
                                <NotificationBadge key={unreadCount} />
                              )}
                          </span>
                          <span className="hidden max-w-full truncate xl:inline">
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
                  isGuest
                    ? (event) =>
                        handleGuestProtectedNavigation(
                          event,
                          "compose-desktop",
                        )
                    : undefined
                }
                aria-label="Yeni konu aç"
                aria-current={
                  isActivePath(pathname, "/konu-olustur")
                    ? "page"
                    : undefined
                }
                title="Konu aç"
                className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-1 text-[10px] font-black leading-none text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/45 xl:min-h-12 xl:gap-2 xl:px-4 xl:text-sm"
              >
                <ShareIcon className="size-[1.35rem] shrink-0 xl:size-5" />
                <span className="hidden xl:inline">Konu aç</span>
              </Link>

              {guestNavStatus && guestNavAnchor === "compose-desktop" && (
                <ActionStatusText
                  status={guestNavStatus}
                  className="mt-2 text-center"
                />
              )}

              {/* X'teki gibi hesap çipi: geniş menüde ad ve kullanıcı adı,
                  dar menüde yalnızca avatar. Çıkış bu menünün içine girer.

                  Misafirde çip yerine giriş bağlantısı var: "İsimsiz
                  Kullanıcı" gerçek bir hesap değil, adı kırpılıp anlamsız
                  görünüyordu ve altındaki menü (Profilim, Çıkış yap) da
                  misafir için işlevsizdi. */}
              <div className="mt-auto pt-3">
                {isGuest ? (
                  <Link
                    href="/giris"
                    title="Giriş yap"
                    className="mx-auto flex size-13 items-center justify-center gap-2 rounded-full bg-brand text-sm font-black text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/45 xl:h-12 xl:w-fit xl:px-4"
                  >
                    <SignInIcon className="size-4 shrink-0" />
                    <span className="hidden xl:inline">Giriş yap</span>
                  </Link>
                ) : (
                <div data-account-menu className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isAccountMenuOpen}
                    onClick={() =>
                      setIsAccountMenuOpen((current) => !current)
                    }
                    title={`@${profile.username}`}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl px-1.5 py-2 outline-none transition-colors hover:bg-white/8 focus-visible:ring-3 focus-visible:ring-brand/40 xl:justify-start xl:px-3"
                  >
                    <CampusAuthorAvatar
                      author={`@${profile.username}`}
                      authorId={LOCAL_ACCOUNT_OWNER_ID}
                      avatarUrl={profile.avatarUrl}
                    />
                    <span className="hidden min-w-0 flex-1 text-left xl:block">
                      <span className="block truncate text-base font-black leading-5">
                        {profile.displayName}
                      </span>
                      <span className="block truncate text-sm font-semibold text-white/55">
                        @{profile.username}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden shrink-0 text-lg leading-none text-white/55 2xl:block"
                    >
                      ···
                    </span>
                  </button>

                  {isAccountMenuOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-surface-raised py-1 shadow-[0_16px_40px_rgba(0,0,0,0.32)]"
                    >
                      <Link
                        href="/profil"
                        role="menuitem"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm font-bold outline-none transition-colors hover:bg-white/7 focus-visible:bg-white/7"
                      >
                        Profilim
                      </Link>
                      <Link
                        href="/ayarlar"
                        role="menuitem"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm font-bold outline-none transition-colors hover:bg-white/7 focus-visible:bg-white/7"
                      >
                        Ayarlar
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          handleSignOut();
                        }}
                        className="block w-full cursor-pointer border-t border-white/8 px-4 py-2.5 text-left text-sm font-bold text-danger outline-none transition-colors hover:bg-danger/9 focus-visible:bg-danger/9"
                      >
                        Çıkış yap
                      </button>
                    </div>
                  )}

                  {signOutStatus && (
                    <ActionStatusText
                      status={signOutStatus}
                      className="absolute bottom-full left-0 z-50 mb-1 w-max max-w-56"
                    />
                  )}
                </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <nav
        aria-label="Mobil uygulama menüsü"
        className={`fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-canvas/92 px-[4px] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-white backdrop-blur-xl transition-transform duration-300 md:hidden ${
          isMobileNavHidden ? "translate-y-full" : "translate-y-0"
        }`}
      >
        {guestNavStatus && guestNavAnchor === "compose-mobile" && (
          <ActionStatusText
            status={guestNavStatus}
            className="absolute inset-x-3 bottom-full mb-2 text-center"
          />
        )}

        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0">
          {mobileNavigationItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  onClick={
                    isGuest && isGuestProtectedPath(item.href)
                      ? (event) =>
                          handleGuestProtectedNavigation(
                            event,
                            "compose-mobile",
                          )
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
                  className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-[2px] text-[10px] font-bold leading-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand/40 min-[360px]:text-[11px] ${
                    item.primary
                      ? "text-brand"
                      : isActive
                        ? "bg-brand/12 text-brand"
                        : "text-white/58 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span
                    className={
                      item.primary
                        ? "relative grid size-10 -translate-y-1 place-items-center rounded-full bg-brand text-[#101012] shadow-none"
                        : "relative grid size-9 place-items-center"
                    }
                  >
                    <NavigationIcon
                      name={item.icon}
                      className={
                        item.primary
                          ? "size-5 shrink-0"
                          : "size-6 shrink-0"
                      }
                    />
                    {item.icon === "notifications" &&
                      areNotificationsHydrated &&
                      unreadCount > 0 && (
                        <NotificationBadge key={unreadCount} />
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
