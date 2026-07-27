import CampusLogo from "@/components/CampusLogo";

type CampusLoadingScreenProps = {
  statusText?: string;
};

export default function CampusLoadingScreen({
  statusText = "KAMPÜS hazırlanıyor",
}: CampusLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusText}
      className="campus-loading-screen fixed inset-0 z-[200] grid min-h-svh place-items-center overflow-hidden px-5 text-[#1c2821] dark:text-[#ece8e1]"
    >
      <span className="sr-only">{statusText}</span>

      <div aria-hidden="true" className="relative flex flex-col items-center">
        <div className="campus-loading-logo text-[#5a2538] dark:text-[#c7896d]">
          <CampusLogo
            variant="mark"
            idPrefix="session-loading-logo"
            markClassName="h-24 w-20 sm:h-28 sm:w-24"
          />
        </div>

        <p className="campus-loading-wordmark mt-3 text-2xl font-black tracking-[-0.06em] sm:text-3xl">
          KAMPÜS
          <span className="text-[#9a5944] dark:text-[#d09272]">.</span>
        </p>

        <p className="campus-loading-credit mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#1c2821]/48 dark:text-white/46 sm:text-[11px]">
          by <span className="text-[#7d3c2d] dark:text-[#d09272]">Yagiz Karagoz</span>
        </p>
      </div>
    </div>
  );
}
