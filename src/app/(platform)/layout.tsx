import AppNavigation from "@/components/AppNavigation";
import { CampusDataProvider } from "@/components/CampusDataProvider";
import CampusRightRail from "@/components/CampusRightRail";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CampusDataProvider>
      <div className="min-h-svh bg-[#eee9e1] text-[#1c2821] transition-colors dark:bg-[#111315] dark:text-[#ece8e1]">
        <a
          href="#platform-content"
          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-full bg-[#5a1f32] px-4 py-2 text-xs font-bold text-white outline-none transition-transform focus:translate-y-0 dark:bg-[#c7896d] dark:text-[#111315]"
        >
          İçeriğe geç
        </a>
        <div className="grid min-h-svh w-full md:grid-cols-[5.25rem_minmax(0,1fr)] min-[1280px]:grid-cols-[15.5rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[17rem_minmax(0,1fr)_24rem]">
          <AppNavigation />
          <main
            id="platform-content"
            tabIndex={-1}
            className="min-w-0 border-x border-[#1c2821]/10 bg-[#f8f4ed]/52 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5a1f32]/35 dark:border-white/9 dark:bg-[#141619] dark:focus-visible:ring-[#c7896d]/40 md:pb-0"
          >
            {children}
          </main>
          <CampusRightRail />
        </div>
      </div>
    </CampusDataProvider>
  );
}
