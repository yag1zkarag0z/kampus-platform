import type { Metadata } from "next";

import PublicInfoHeader from "@/components/PublicInfoHeader";
import SecuritySection from "@/components/SecuritySection";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Güvenlik | KAMPÜS.",
  description: "KAMPÜS’te doğrulama, anonimlik ve moderasyon yaklaşımı.",
};

export default function SecurityPage() {
  return (
    <>
      <PublicInfoHeader />
      <main>
        <SecuritySection />
      </main>
      <SiteFooter />
    </>
  );
}
