import AppNavigation from "@/components/AppNavigation";
import CampusCalendarWidget from "@/components/CampusCalendarWidget";
import { CampusAccountProvider } from "@/components/CampusAccountProvider";
import { CampusDataProvider } from "@/components/CampusDataProvider";
import { CampusFollowProvider } from "@/components/CampusFollowProvider";
import { CampusModerationProvider } from "@/components/CampusModerationProvider";
import { CampusNotificationProvider } from "@/components/CampusNotificationProvider";
import CampusSessionGate from "@/components/CampusSessionGate";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import FollowSuggestions from "@/components/FollowSuggestions";

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
                  <div className="min-h-svh bg-[#0a0d16] text-white transition-colors">
              <a
                href="#platform-content"
                className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#12100e] outline-none transition-transform focus:translate-y-0"
              >
                İçeriğe geç
              </a>
              <div className="min-h-svh w-full md:grid md:grid-cols-[minmax(6.5rem,1fr)_minmax(0,56rem)_minmax(6.5rem,1fr)]">
                <AppNavigation />
                <main
                  id="platform-content"
                  tabIndex={-1}
                  className="min-w-0 border-x border-white/9 bg-[#0a0d16] pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff7a45]/40 md:col-start-2 md:row-start-1 md:pb-0"
                >
                  {children}
                </main>
                <div className="hidden min-w-0 md:col-start-3 md:row-start-1 md:block">
                  <div className="sticky top-0 max-h-svh space-y-3 overflow-y-auto p-3">
                    <FollowSuggestions />
                    <CampusCalendarWidget />
                  </div>
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
