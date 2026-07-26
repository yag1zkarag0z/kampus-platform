import type { Metadata } from "next";
import CampusFeed from "@/components/CampusFeed";

export const metadata: Metadata = {
  title: "Kampüs Gündemi | KAMPÜS.",
  description:
    "Yaşar öğrencilerinin açtığı konuları keşfet, beğen ve kampüs tartışmalarına katıl.",
};

export default function CampusFeedPage() {
  return <CampusFeed />;
}
