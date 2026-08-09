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
import { guestNotifications } from "@/data/campusNotifications";
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "@/notifications/client";

const UNREAD_COUNT_POLL_INTERVAL_MS = 45_000;
const GUEST_NOTIFICATIONS_READ_KEY = "kampus:guest-notifications-read";

function hasReadGuestNotifications() {
  try {
    return window.sessionStorage.getItem(GUEST_NOTIFICATIONS_READ_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberGuestNotificationsRead() {
  try {
    window.sessionStorage.setItem(GUEST_NOTIFICATIONS_READ_KEY, "1");
  } catch {
    // Storage can be unavailable in strict privacy modes. In-memory state still
    // behaves correctly for the current page lifetime.
  }
}

function initialGuestNotifications() {
  if (!hasReadGuestNotifications()) {
    return guestNotifications;
  }

  return guestNotifications.map((notification) => ({
    ...notification,
    isRead: true,
  }));
}

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
      // Misafirde sabit veri kullanılıyor; ağ isteği yok, anında hazır.
      queueMicrotask(() => {
        if (isCancelled) {
          return;
        }

        setUnreadCount(
          hasReadGuestNotifications()
            ? 0
            : guestNotifications.filter(
                (notification) => !notification.isRead,
              ).length,
        );
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

    if (sessionMode !== "member") {
      // Misafirde sabit veri kullanılıyor; yol koşuluna gerek yok, anında
      // hazır — /bildirimler'e hiç uğramadan da rozet doğru sayıyı gösterir.
      queueMicrotask(() => {
        if (!isCancelled) {
          setNotifications((current) =>
            current.length > 0 &&
            current.every((notification) =>
              notification.id.startsWith("guest-notif-"),
            )
              ? current
              : initialGuestNotifications(),
          );
          setNextCursor(null);
          setIsNotificationsHydrated(true);
        }
      });

      return () => {
        isCancelled = true;
      };
    }

    const shouldLoadList = pathname?.startsWith("/bildirimler") ?? false;

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

      // Misafirde bu yalnızca yerel state; sabit veri için kalıcı bir
      // sunucu tarafı yok.
      if (sessionMode !== "member") {
        return;
      }

      try {
        await markNotificationRead(notificationId);
      } catch {
        // Optimistic update stays applied; the next refresh reconciles it.
      }
    },
    [notifications, sessionMode],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(
      (notification) => !notification.isRead,
    );
    const unreadTotal = Math.max(unreadCount, unreadNotifications.length);

    if (unreadTotal === 0) {
      return 0;
    }

    if (sessionMode !== "member") {
      if (sessionMode === "guest") {
        rememberGuestNotificationsRead();
      }
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      );
      setUnreadCount(0);
      return unreadTotal;
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    setUnreadCount(0);

    try {
      const result = await markAllNotificationsRead();
      return result.markedCount;
    } catch {
      return unreadTotal;
    }
  }, [notifications, sessionMode, unreadCount]);

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
