import type { Metadata } from "next";

import FAQSection from "@/components/FAQSection";
import PublicInfoHeader from "@/components/PublicInfoHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Sık Sorulan Sorular | KAMPÜS.",
  description: "KAMPÜS hakkında sık sorulan sorular ve kısa yanıtlar.",
};

export default function FAQPage() {
  return (
    <>
      <PublicInfoHeader />
      <main>
        <FAQSection />
      </main>
      <SiteFooter />
    </>
  );
}
