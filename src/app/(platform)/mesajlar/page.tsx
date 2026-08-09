import type { Metadata } from "next";
import { Suspense } from "react";

import CampusMessages from "@/components/CampusMessages";

export const metadata: Metadata = {
  title: "Mesajlar | KAMPÜS.",
  description: "Kampüsteki öğrencilerle bire bir konuş.",
};

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesPageFallback />}>
      <CampusMessages />
    </Suspense>
  );
}

function MessagesPageFallback() {
  return (
    <div
      role="status"
      aria-label="Mesajlar yükleniyor"
      className="grid min-h-[calc(100svh-4rem)] place-items-center bg-canvas md:min-h-svh"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-white/15 border-t-brand motion-reduce:animate-none" />
    </div>
  );
}
