import type { ReactNode } from "react";
import CampusLogo from "@/components/CampusLogo";

type PlatformRouteStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  fullPage?: boolean;
};

export default function PlatformRouteState({
  eyebrow,
  title,
  description,
  actions,
  fullPage = false,
}: PlatformRouteStateProps) {
  return (
    <section
      className={`grid place-items-center bg-[#f8f4ed]/62 px-5 py-16 text-center text-[#1c2821] dark:bg-[#141619] dark:text-[#ece8e1] ${
        fullPage
          ? "min-h-svh"
          : "min-h-[calc(100svh-4rem)] md:min-h-svh"
      }`}
    >
      <div className="w-full max-w-md">
        <div
          aria-hidden="true"
          className="mx-auto grid size-16 place-items-center rounded-full border border-[#1c2821]/12 bg-[#e9dfd5] text-[#5a2538] shadow-[0_18px_48px_rgba(28,40,33,0.08)] dark:border-white/10 dark:bg-[#211b1f] dark:text-[#d09272] dark:shadow-black/20"
        >
          <CampusLogo
            variant="mark"
            idPrefix={`route-state-${fullPage ? "full" : "platform"}`}
            markClassName="h-10 w-9"
          />
        </div>

        <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.055em] text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
          {description}
        </p>

        {actions ? (
          <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 min-[420px]:flex-row">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
