import GuestEntryButton from "@/components/GuestEntryButton";
import HomepageTrackedLink from "@/components/HomepageTrackedLink";

export default function ClosingCTA() {
  return (
    <section
      aria-labelledby="closing-title"
      className="border-b border-white/8 bg-canvas text-white"
    >
      <div className="mx-auto w-full max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10">
        <div className="flex flex-col gap-5 rounded-2xl border border-white/9 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <h2
            id="closing-title"
            className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl"
          >
            Kampüse katıl<span className="text-brand">.</span>
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row">
            <GuestEntryButton
              analyticsSource="closing_guest"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65"
            >
              Misafir olarak göz at <span aria-hidden="true">→</span>
            </GuestEntryButton>
            <HomepageTrackedLink
              href="/kayit"
              source="closing_register"
              target="register"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-semibold text-white outline-none transition-colors hover:border-white/28 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white"
            >
              Kayıt ol
            </HomepageTrackedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
