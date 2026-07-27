import type { Metadata } from "next";
import CampusProfile from "@/components/CampusProfile";

export const metadata: Metadata = {
  title: "Profil | KAMPÜS.",
  description:
    "KAMPÜS profil bilgilerini, konularını ve yorumlarını görüntüle.",
};

export default function ProfilePage() {
  return <CampusProfile />;
}
