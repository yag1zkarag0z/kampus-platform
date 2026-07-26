import type { Metadata } from "next";
import PlatformEmptyState from "@/components/PlatformEmptyState";

export const metadata: Metadata = {
  title: "Profil | KAMPÜS.",
};

export default function ProfilePage() {
  return (
    <PlatformEmptyState
      eyebrow="Öğrenci profili"
      title="Profil"
      description="Kullanıcı bilgilerin, gönderilerin ve profil ayarların burada yer alacak."
    />
  );
}
