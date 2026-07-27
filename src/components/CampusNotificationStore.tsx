"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusNotifications } from "@/data/campusNotifications";

const STORAGE_KEY_PREFIX = "kampus-notification-read-ids-v1";
const READ_STATE_EVENT = "kampus-notification-read-state";
const knownNotificationIds = new Set(
  campusNotifications.map((notification) => notification.id),
);
const initiallyReadIds = campusNotifications
  .filter((notification) => notification.initiallyRead)
  .map((notification) => notification.id);

type NotificationReadStateDetail = {
  storageKey: string;
  readIds: string[];
};

function normalizeReadIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    !value.every((notificationId) => typeof notificationId === "string")
  ) {
    return new Set(initiallyReadIds);
  }

  return new Set(
    value.filter((notificationId) =>
      knownNotificationIds.has(notificationId),
    ),
  );
}

function readStoredIds(storageKey: string) {
  try {
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return new Set(initiallyReadIds);
    }

    return normalizeReadIds(JSON.parse(storedValue) as unknown);
  } catch {
    return new Set(initiallyReadIds);
  }
}

export function useCampusNotificationStore() {
  const { isGuest, isHydrated: isAccountHydrated } =
    useCampusAccount();
  const storageKey = `${STORAGE_KEY_PREFIX}-${
    isGuest ? "guest" : "member"
  }`;
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(initiallyReadIds),
  );
  const readIdsRef = useRef(readIds);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<
    string | null
  >(null);

  const updateSnapshot = useCallback((nextReadIds: Set<string>) => {
    readIdsRef.current = nextReadIds;
    setReadIds(nextReadIds);
  }, []);

  useEffect(() => {
    if (!isAccountHydrated) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      updateSnapshot(readStoredIds(storageKey));
      setHydratedStorageKey(storageKey);
    });

    return () => {
      isCancelled = true;
    };
  }, [isAccountHydrated, storageKey, updateSnapshot]);

  useEffect(() => {
    if (!isAccountHydrated) {
      return;
    }

    const syncReadState = (nextReadIds: Set<string>) => {
      updateSnapshot(nextReadIds);
      setHydratedStorageKey(storageKey);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      if (!event.newValue) {
        syncReadState(new Set(initiallyReadIds));
        return;
      }

      try {
        syncReadState(
          normalizeReadIds(JSON.parse(event.newValue) as unknown),
        );
      } catch {
        syncReadState(new Set(initiallyReadIds));
      }
    };

    const handleLocalReadState = (event: Event) => {
      const readStateEvent =
        event as CustomEvent<NotificationReadStateDetail>;

      if (readStateEvent.detail.storageKey !== storageKey) {
        return;
      }

      syncReadState(normalizeReadIds(readStateEvent.detail.readIds));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(READ_STATE_EVENT, handleLocalReadState);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        READ_STATE_EVENT,
        handleLocalReadState,
      );
    };
  }, [isAccountHydrated, storageKey, updateSnapshot]);

  const commitReadIds = useCallback(
    (nextReadIds: Set<string>) => {
      const normalizedReadIds = normalizeReadIds(
        Array.from(nextReadIds),
      );
      const serializedReadIds = Array.from(normalizedReadIds);

      updateSnapshot(normalizedReadIds);

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(serializedReadIds),
        );
      } catch {
        // Notification state remains usable for the current tab.
      }

      window.dispatchEvent(
        new CustomEvent<NotificationReadStateDetail>(READ_STATE_EVENT, {
          detail: {
            storageKey,
            readIds: serializedReadIds,
          },
        }),
      );
    },
    [storageKey, updateSnapshot],
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (
        !knownNotificationIds.has(notificationId) ||
        readIdsRef.current.has(notificationId)
      ) {
        return false;
      }

      const nextReadIds = new Set(readIdsRef.current);
      nextReadIds.add(notificationId);
      commitReadIds(nextReadIds);
      return true;
    },
    [commitReadIds],
  );

  const markAllAsRead = useCallback(() => {
    const unreadCount =
      campusNotifications.length - readIdsRef.current.size;

    if (unreadCount === 0) {
      return 0;
    }

    commitReadIds(new Set(knownNotificationIds));
    return unreadCount;
  }, [commitReadIds]);

  const unreadCount = useMemo(
    () =>
      campusNotifications.filter(
        (notification) => !readIds.has(notification.id),
      ).length,
    [readIds],
  );

  return {
    isHydrated:
      isAccountHydrated && hydratedStorageKey === storageKey,
    readIds,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
