"use client";

import { usePathname } from "next/navigation";
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

import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "@/notifications/client";

const UNREAD_COUNT_POLL_INTERVAL_MS = 45_000;

type CampusNotificationContextValue = {
  notifications: NotificationDto[];
  isNotificationsHydrated: boolean;
  hasMoreNotifications: boolean;
  isLoadingMoreNotifications: boolean;
  loadMoreNotifications: () => Promise<void>;
  unreadCount: number;
  isUnreadCountHydrated: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<number>;
};

const CampusNotificationContext = createContext<
  CampusNotificationContextValue | undefined
>(undefined);

export function CampusNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { accountId, sessionMode } = useCampusAccount();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isNotificationsHydrated, setIsNotificationsHydrated] =
    useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] =
    useState(false);
  const isLoadingMoreRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isUnreadCountHydrated, setIsUnreadCountHydrated] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    if (sessionMode !== "member") {
      queueMicrotask(() => {
        if (isCancelled) {
          return;
        }

        setUnreadCount(0);
        setIsUnreadCountHydrated(true);
      });

      return () => {
        isCancelled = true;
      };
    }

    const poll = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      getMyUnreadNotificationCount()
        .then((result) => {
          if (!isCancelled) {
            setUnreadCount(result.count);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!isCancelled) {
            setIsUnreadCountHydrated(true);
          }
        });
    };

    const handleVisibilityChange = () => {
      poll();
    };

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsUnreadCountHydrated(false);
      }
    });
    queueMicrotask(poll);

    const timer = window.setInterval(poll, UNREAD_COUNT_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [accountId, sessionMode]);

  useEffect(() => {
    let isCancelled = false;
    const shouldLoadList =
      sessionMode === "member" && (pathname?.startsWith("/bildirimler") ?? false);

    if (!shouldLoadList) {
      return () => {
        isCancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsNotificationsHydrated(false);
      }
    });

    getMyNotifications()
      .then((result) => {
        if (!isCancelled) {
          setNotifications(result.data);
          setNextCursor(
            result.page.hasMore ? result.page.nextCursor : null,
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setIsNotificationsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accountId, pathname, sessionMode]);

  const loadMoreNotifications = useCallback(async () => {
    if (!nextCursor || isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMoreNotifications(true);

    try {
      const result = await getMyNotifications({ cursor: nextCursor });

      setNotifications((current) => {
        const knownIds = new Set(current.map((item) => item.id));

        return [
          ...current,
          ...result.data.filter((item) => !knownIds.has(item.id)),
        ];
      });
      setNextCursor(result.page.hasMore ? result.page.nextCursor : null);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMoreNotifications(false);
    }
  }, [nextCursor]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (sessionMode !== "member") {
        return;
      }

      const target = notifications.find(
        (notification) => notification.id === notificationId,
      );

      if (!target || target.isRead) {
        return;
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await markNotificationRead(notificationId);
      } catch {
        // Optimistic update stays applied; the next refresh reconciles it.
      }
    },
    [notifications, sessionMode],
  );

  const markAllAsRead = useCallback(async () => {
    if (sessionMode !== "member") {
      return 0;
    }

    const unreadNotifications = notifications.filter(
      (notification) => !notification.isRead,
    );

    if (unreadNotifications.length === 0) {
      return 0;
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    setUnreadCount(0);

    try {
      const result = await markAllNotificationsRead();
      return result.markedCount;
    } catch {
      return unreadNotifications.length;
    }
  }, [notifications, sessionMode]);

  const value = useMemo<CampusNotificationContextValue>(
    () => ({
      notifications,
      isNotificationsHydrated,
      hasMoreNotifications: nextCursor !== null,
      isLoadingMoreNotifications,
      loadMoreNotifications,
      unreadCount,
      isUnreadCountHydrated,
      markAsRead,
      markAllAsRead,
    }),
    [
      isLoadingMoreNotifications,
      isNotificationsHydrated,
      isUnreadCountHydrated,
      loadMoreNotifications,
      markAllAsRead,
      markAsRead,
      nextCursor,
      notifications,
      unreadCount,
    ],
  );

  return (
    <CampusNotificationContext.Provider value={value}>
      {children}
    </CampusNotificationContext.Provider>
  );
}

export function useCampusNotifications() {
  const context = useContext(CampusNotificationContext);

  if (!context) {
    throw new Error(
      "useCampusNotifications must be used within CampusNotificationProvider.",
    );
  }

  return context;
}
