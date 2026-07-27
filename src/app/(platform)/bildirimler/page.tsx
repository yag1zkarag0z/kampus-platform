import type { Metadata } from "next";

import CampusNotifications from "@/components/CampusNotifications";

export const metadata: Metadata = {
  title: "Bildirimler | KAMPÜS.",
  description:
    "Yorumları, yanıtları, bahsetmeleri ve KAMPÜS duyurularını takip et.",
};

export default function NotificationsPage() {
  return <CampusNotifications />;
}
