import type { Metadata } from "next";

import CampusSettings from "@/components/CampusSettings";

export const metadata: Metadata = {
  title: "Ayarlar | KAMPÜS.",
  description: "KAMPÜS hesap, gizlilik ve bildirim tercihlerini yönet.",
};

export default function SettingsPage() {
  return <CampusSettings />;
}
