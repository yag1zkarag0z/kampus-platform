import type { Metadata } from "next";

import EditCampusProfile from "@/components/EditCampusProfile";

export const metadata: Metadata = {
  title: "Profili Düzenle | KAMPÜS.",
  description: "KAMPÜS profil ve kampüs bilgilerini güncelle.",
};

export default function EditProfilePage() {
  return <EditCampusProfile />;
}
