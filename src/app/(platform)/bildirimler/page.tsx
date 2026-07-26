import type { Metadata } from "next";
import PlatformEmptyState from "@/components/PlatformEmptyState";

export const metadata: Metadata = {
  title: "Bildirimler | KAMPÜS.",
};

export default function NotificationsPage() {
  return (
    <PlatformEmptyState
      eyebrow="Sıradaki ekran"
      title="Bildirimler"
      description="Gönderilerine gelen beğeniler, yorumlar ve yanıtlar burada görünecek."
    />
  );
}
