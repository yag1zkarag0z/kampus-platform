import type { Metadata } from "next";

import HowItWorks from "@/components/HowItWorks";
import PublicInfoHeader from "@/components/PublicInfoHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Nasıl Çalışır? | KAMPÜS.",
  description: "KAMPÜS’e katılma ve paylaşmaya başlama adımları.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PublicInfoHeader />
      <main>
        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  );
}
