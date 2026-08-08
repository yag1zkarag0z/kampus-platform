import ClosingCTA from "@/components/ClosingCTA";
import Hero from "@/components/Hero";
import HomepageBentoLazy from "@/components/HomepageBentoLazy";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <HomepageBentoLazy />
        <ClosingCTA />
      </main>
      <SiteFooter />
    </>
  );
}
