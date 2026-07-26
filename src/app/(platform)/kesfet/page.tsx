import type { Metadata } from "next";
import CampusExplore from "@/components/CampusExplore";

export const metadata: Metadata = {
  title: "Keşfet | KAMPÜS.",
  description:
    "Kampüsteki konuları ara, kategorilere göz at ve öne çıkan gönderileri keşfet.",
};

export default function ExplorePage() {
  return <CampusExplore />;
}
