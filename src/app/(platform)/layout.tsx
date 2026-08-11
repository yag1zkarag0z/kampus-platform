import AppNavigation from "@/components/AppNavigation";
import { CampusAccountProvider } from "@/components/CampusAccountProvider";
import { CampusDataProvider } from "@/components/CampusDataProvider";
import { CampusFollowProvider } from "@/components/CampusFollowProvider";
import { CampusModerationProvider } from "@/components/CampusModerationProvider";
import { CampusMessagingProvider } from "@/components/CampusMessagingProvider";
import { CampusNotificationProvider } from "@/components/CampusNotificationProvider";
import { CampusRealtimeProvider } from "@/components/CampusRealtimeProvider";
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
              <CampusRealtimeProvider>
                <CampusMessagingProvider>
                  <CampusFollowProvider>
                    <CampusDataProvider>
                      <div className="min-h-svh bg-canvas text-white">
                        <a
                          href="#platform-content"
                          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#101012] outline-none transition-transform focus:translate-y-0"
                        >
                          İçeriğe geç
                        </a>
                        {/* 1536 px'de X'e yakın 300 / 720 / 460 px tabanı korunur.
                            Daha geniş ekranlarda üç sütun birlikte kontrollü büyür;
                            akış 800 px'i geçmez ve kartlar gereksiz yere yayılmaz. */}
                        <div className="platform-shell min-h-svh w-full md:grid md:justify-center md:grid-cols-[4rem_minmax(0,35rem)] xl:grid-cols-[12rem_minmax(0,35rem)_16.5rem] 2xl:grid-cols-[clamp(15rem,16vw,17rem)_clamp(36rem,39vw,40rem)_clamp(23rem,25vw,25rem)]">
                          <AppNavigation />
                          <main
                            id="platform-content"
                            tabIndex={-1}
                            className="route-page min-w-0 overflow-x-hidden border-x border-white/8 bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 md:col-start-2 md:row-start-1 md:pb-0"
                          >
                            {children}
                          </main>
                          <div className="platform-right-rail-column hidden min-w-0 xl:col-start-3 xl:row-start-1 xl:block">
                            <PlatformRightRail />
                          </div>
                        </div>
                      </div>
                    </CampusDataProvider>
                  </CampusFollowProvider>
                </CampusMessagingProvider>
              </CampusRealtimeProvider>
            </CampusNotificationProvider>
          </CampusModerationProvider>
        </CampusSessionGate>
      </FeedbackProvider>
    </CampusAccountProvider>
  );
}
