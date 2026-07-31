import ClosingCTA from "@/components/ClosingCTA";
import CampusPulseSection from "@/components/CampusPulseSection";
import FAQSection from "@/components/FAQSection";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import SecuritySection from "@/components/SecuritySection";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <CampusPulseSection />
        <HowItWorks />
        <SecuritySection />
        <FAQSection />
        <ClosingCTA />
      </main>
      <SiteFooter />
    </>
  );
}
