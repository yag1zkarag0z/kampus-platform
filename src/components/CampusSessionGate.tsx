"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusLoadingScreen from "@/components/CampusLoadingScreen";

export default function CampusSessionGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { isHydrated, isSignedIn } = useCampusAccount();
  const [isIntroComplete, setIsIntroComplete] = useState(false);

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
      router.replace("/giris");
    }
  }, [isHydrated, isSignedIn, router]);

  if (!isHydrated || (isSignedIn && !isIntroComplete)) {
    return <CampusLoadingScreen />;
  }

  if (!isSignedIn) {
    return <CampusLoadingScreen statusText="Çıkış yapılıyor" />;
  }

  return children;
}
