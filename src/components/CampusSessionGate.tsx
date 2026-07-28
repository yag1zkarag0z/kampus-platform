"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusLoadingScreen from "@/components/CampusLoadingScreen";

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
    sessionExpired,
    role,
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
    if (isHydrated && !isSignedIn) {
      router.replace(
        sessionExpired ? "/giris?reason=session-expired" : "/giris",
      );
    } else if (isHydrated && isGuest && !isGuestRouteAllowed) {
      router.replace("/akis");
    } else if (isHydrated && isSignedIn && !canAccessAdmin) {
      router.replace("/akis");
    }
  }, [
    isGuest,
    isGuestRouteAllowed,
    canAccessAdmin,
    isHydrated,
    isSignedIn,
    router,
    sessionExpired,
  ]);

  if (!isHydrated || (isSignedIn && !isIntroComplete)) {
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
