"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AuthClientError } from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusRealtime } from "@/components/CampusRealtimeProvider";
import { guestUnreadMessageCount } from "@/data/campusMessages";
import { getUnreadDirectMessageCount } from "@/messaging/client";

type CampusMessagingContextValue = {
  unreadMessageCount: number;
  isUnreadMessageCountHydrated: boolean;
  markGuestMessagesRead: () => void;
  refreshUnreadMessageCount: () => Promise<void>;
};

const CampusMessagingContext = createContext<
  CampusMessagingContextValue | undefined
>(undefined);

const POLL_INTERVAL_MS = 20_000;
const CONNECTED_SAFETY_POLL_INTERVAL_MS = 60_000;
const GUEST_MESSAGES_READ_KEY = "kampus:guest-messages-read";

function hasReadGuestMessages() {
  try {
    return window.sessionStorage.getItem(GUEST_MESSAGES_READ_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberGuestMessagesRead() {
  try {
    window.sessionStorage.setItem(GUEST_MESSAGES_READ_KEY, "1");
  } catch {
    // In-memory state is enough when storage is unavailable.
  }
}

export function CampusMessagingProvider({ children }: { children: ReactNode }) {
  const { sessionMode, retrySession } = useCampusAccount();
  const { status: realtimeStatus, subscribe } = useCampusRealtime();
  const isRealtimeConnected = realtimeStatus === "connected";
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const requestRef = useRef<Promise<void> | null>(null);

  const refreshUnreadMessageCount = useCallback(() => {
    if (sessionMode === "guest") {
      setUnreadMessageCount(
        hasReadGuestMessages() ? 0 : guestUnreadMessageCount,
      );
      setIsHydrated(true);
      return Promise.resolve();
    }

    if (sessionMode !== "member") {
      setUnreadMessageCount(0);
      setIsHydrated(true);
      return Promise.resolve();
    }

    if (requestRef.current) {
      return requestRef.current;
    }

    const request = getUnreadDirectMessageCount()
      .then(({ count }) => setUnreadMessageCount(count))
      .catch((error: unknown) => {
        if (error instanceof AuthClientError && error.status === 401) {
          void retrySession();
        }
      })
      .finally(() => {
        setIsHydrated(true);
        requestRef.current = null;
      });

    requestRef.current = request;
    return request;
  }, [retrySession, sessionMode]);

  const markGuestMessagesRead = useCallback(() => {
    if (sessionMode !== "guest") return;
    rememberGuestMessagesRead();
    setUnreadMessageCount(0);
    setIsHydrated(true);
  }, [sessionMode]);

  useEffect(() => {
    queueMicrotask(() => void refreshUnreadMessageCount());

    if (sessionMode !== "member") {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshUnreadMessageCount();
      }
    }, isRealtimeConnected
      ? CONNECTED_SAFETY_POLL_INTERVAL_MS
      : POLL_INTERVAL_MS);
    const refreshOnFocus = () => void refreshUnreadMessageCount();
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [isRealtimeConnected, refreshUnreadMessageCount, sessionMode]);

  useEffect(() =>
    subscribe((event) => {
      if (event.type === "conversation.invalidate") {
        void refreshUnreadMessageCount();
      }
    }),
  [refreshUnreadMessageCount, subscribe]);

  const value = useMemo<CampusMessagingContextValue>(
    () => ({
      unreadMessageCount,
      isUnreadMessageCountHydrated: isHydrated,
      markGuestMessagesRead,
      refreshUnreadMessageCount,
    }),
    [
      isHydrated,
      markGuestMessagesRead,
      refreshUnreadMessageCount,
      unreadMessageCount,
    ],
  );

  return (
    <CampusMessagingContext.Provider value={value}>
      {children}
    </CampusMessagingContext.Provider>
  );
}

export function useCampusMessaging() {
  const context = useContext(CampusMessagingContext);

  if (!context) {
    throw new Error(
      "useCampusMessaging must be used within CampusMessagingProvider.",
    );
  }

  return context;
}
