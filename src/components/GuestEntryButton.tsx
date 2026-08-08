"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { trackHomepageCta } from "@/analytics/homepageClient";
import type { HomepageCtaSource } from "@/analytics/homepageEvents";
import { startGuestSession } from "@/auth/client";

type GuestEntryButtonProps = {
  children: ReactNode;
  className?: string;
  analyticsSource?: HomepageCtaSource;
};

export default function GuestEntryButton({
  children,
  className = "",
  analyticsSource,
}: GuestEntryButtonProps) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);

  const openGuestView = async () => {
    if (isOpening) return;

    if (analyticsSource) {
      trackHomepageCta(analyticsSource, "guest");
    }

    setIsOpening(true);

    try {
      await startGuestSession();
      router.push("/akis");
    } catch {
      router.push("/giris");
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void openGuestView();
      }}
      disabled={isOpening}
      aria-busy={isOpening}
      className={className}
    >
      {isOpening ? "Açılıyor…" : children}
    </button>
  );
}
