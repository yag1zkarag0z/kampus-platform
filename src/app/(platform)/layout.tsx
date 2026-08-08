import AppNavigation from "@/components/AppNavigation";
import { CampusAccountProvider } from "@/components/CampusAccountProvider";
import { CampusDataProvider } from "@/components/CampusDataProvider";
import { CampusFollowProvider } from "@/components/CampusFollowProvider";
import { CampusModerationProvider } from "@/components/CampusModerationProvider";
import { CampusNotificationProvider } from "@/components/CampusNotificationProvider";
import CampusSessionGate from "@/components/CampusSessionGate";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import PlatformRightRail from "@/components/PlatformRightRail";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CampusAccountProvider>
      <FeedbackProvider>
        <CampusSessionGate>
          <CampusModerationProvider>
            <CampusNotificationProvider>
              <CampusFollowProvider>
                <CampusDataProvider>
                  <div className="min-h-svh bg-canvas text-white">
              <a
                href="#platform-content"
                className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#101012] outline-none transition-transform focus:translate-y-0"
              >
                İçeriğe geç
              </a>
              {/* Büyük masaüstünde X'e yakın 300 / 720 / 460 px oranı:
                  akış okunabilir kalırken navigasyon ve sağ panel dolgun durur. */}
              <div className="min-h-svh w-full md:grid md:justify-center md:grid-cols-[4rem_minmax(0,35rem)] xl:grid-cols-[12rem_minmax(0,35rem)_16.5rem] 2xl:grid-cols-[15rem_minmax(0,36rem)_23rem]">
                <AppNavigation />
                <main
                  id="platform-content"
                  tabIndex={-1}
                  className="route-page min-w-0 overflow-x-hidden border-x border-white/8 bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 md:col-start-2 md:row-start-1 md:pb-0"
                >
                  {children}
                </main>
                <div className="hidden min-w-0 xl:col-start-3 xl:row-start-1 xl:block">
                  <PlatformRightRail />
                </div>
              </div>
                  </div>
                </CampusDataProvider>
              </CampusFollowProvider>
            </CampusNotificationProvider>
          </CampusModerationProvider>
        </CampusSessionGate>
      </FeedbackProvider>
    </CampusAccountProvider>
  );
}
