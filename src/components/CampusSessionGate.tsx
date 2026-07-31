"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusLoadingScreen from "@/components/CampusLoadingScreen";
import PlatformRouteState from "@/components/PlatformRouteState";

export default function CampusSessionGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isHydrated,
    isSignedIn,
    isGuest,
    isSessionLoading,
    sessionError,
    sessionExpired,
    role,
    retrySession,
  } = useCampusAccount();
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const isGuestProfileRoute =
    pathname === "/profil" ||
    (pathname.startsWith("/profil/") &&
      pathname !== "/profil/duzenle");
  const isGuestRouteAllowed =
    pathname === "/akis" ||
    pathname === "/kesfet" ||
    pathname === "/bildirimler" ||
    pathname === "/kaydedilenler" ||
    isGuestProfileRoute ||
    pathname.startsWith("/gonderi/");
  const canAccessAdmin =
    pathname !== "/admin" || role === "admin" || role === "moderator";

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timeout = window.setTimeout(
      () => setIsIntroComplete(true),
      prefersReducedMotion ? 320 : 1280,
    );

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (isHydrated && !sessionError && !isSignedIn) {
      router.replace(
        sessionExpired ? "/giris?reason=session-expired" : "/giris",
      );
    } else if (
      isHydrated &&
      !sessionError &&
      isGuest &&
      !isGuestRouteAllowed
    ) {
      router.replace("/akis");
    } else if (
      isHydrated &&
      !sessionError &&
      isSignedIn &&
      !canAccessAdmin
    ) {
      router.replace("/akis");
    }
  }, [
    isGuest,
    isGuestRouteAllowed,
    canAccessAdmin,
    isHydrated,
    isSignedIn,
    router,
    sessionError,
    sessionExpired,
  ]);

  if (!isHydrated) {
    return <CampusLoadingScreen />;
  }

  if (sessionError) {
    return (
      <PlatformRouteState
        eyebrow="Bağlantı sorunu"
        title="Oturum kontrol edilemedi"
        description={sessionError}
        actions={
          <button
            type="button"
            disabled={isSessionLoading}
            aria-busy={isSessionLoading}
            onClick={() => {
              void retrySession();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-xs font-black text-[#12100e] outline-none transition-colors hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/40 disabled:cursor-wait disabled:opacity-60"
          >
            {isSessionLoading ? "Kontrol ediliyor…" : "Tekrar dene"}
          </button>
        }
      />
    );
  }

  if (isSignedIn && !isIntroComplete) {
    return <CampusLoadingScreen />;
  }

  if (!isSignedIn) {
    return <CampusLoadingScreen statusText="Çıkış yapılıyor" />;
  }

  if (isGuest && !isGuestRouteAllowed) {
    return <CampusLoadingScreen statusText="Misafir görünümüne dönülüyor" />;
  }

  if (!canAccessAdmin) {
    return <CampusLoadingScreen statusText="Akışa dönülüyor" />;
  }

  return children;
}
