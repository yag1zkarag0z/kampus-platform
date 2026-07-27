import type { Metadata } from "next";

import CampusAdminPanel from "@/components/CampusAdminPanel";

export const metadata: Metadata = {
  title: "Yönetim Paneli | KAMPÜS.",
  description:
    "Şikâyetleri, kullanıcı rollerini ve moderasyon geçmişini yöneten KAMPÜS yönetim alanı.",
};

export default function AdminPage() {
  return <CampusAdminPanel />;
}
