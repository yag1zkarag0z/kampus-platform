import AppNavigation from "@/components/AppNavigation";
import { CampusAccountProvider } from "@/components/CampusAccountProvider";
import { CampusDataProvider } from "@/components/CampusDataProvider";
import CampusSessionGate from "@/components/CampusSessionGate";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CampusAccountProvider>
      <CampusSessionGate>
        <CampusDataProvider>
          <div className="min-h-svh bg-[#eee9e1] text-[#1c2821] transition-colors dark:bg-[#111315] dark:text-[#ece8e1]">
            <a
              href="#platform-content"
              className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-full bg-[#5a1f32] px-4 py-2 text-xs font-bold text-white outline-none transition-transform focus:translate-y-0 dark:bg-[#c7896d] dark:text-[#111315]"
            >
              İçeriğe geç
            </a>
            <div className="min-h-svh w-full">
              <AppNavigation />
              <main
                id="platform-content"
                tabIndex={-1}
                className="min-w-0 border-x border-[#1c2821]/10 bg-[#f8f4ed]/52 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5a1f32]/35 dark:border-white/9 dark:bg-[#141619] dark:focus-visible:ring-[#c7896d]/40 md:pb-0"
              >
                {children}
              </main>
            </div>
          </div>
        </CampusDataProvider>
      </CampusSessionGate>
    </CampusAccountProvider>
  );
}
