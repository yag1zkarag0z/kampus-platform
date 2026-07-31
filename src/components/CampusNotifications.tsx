"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusNotificationStore } from "@/components/CampusNotificationStore";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  campusNotifications,
  type CampusNotification,
  type CampusNotificationKind,
} from "@/data/campusNotifications";

type NotificationFilter = "all" | "unread" | "mentions";

const mentionKinds = new Set<CampusNotificationKind>(["mention", "reply"]);
const commentTargetKinds = new Set<CampusNotificationKind>([
  "comment",
  "mention",
  "reply",
]);
const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

const filterOptions: {
  id: NotificationFilter;
  label: string;
}[] = [
  { id: "all", label: "Tümü" },
  { id: "unread", label: "Okunmamış" },
  { id: "mentions", label: "Bahsetmeler" },
];

function getNotificationHref(notification: CampusNotification) {
  if (notification.kind === "follow") {
    const username = notification.actor.username ?? notification.actor.id;
    return `/profil/${encodeURIComponent(username)}`;
  }

  if (!notification.postId) {
    return "/bildirimler";
  }

  const searchParams = new URLSearchParams({
    bildirim: notification.id,
  });

  if (commentTargetKinds.has(notification.kind)) {
    searchParams.set("hedef", "yorum");
    if (notification.commentId) {
      searchParams.set("yorum", notification.commentId);
    }
    return `/gonderi/${notification.postId}?${searchParams.toString()}#${
      notification.commentId
        ? `yorum-${notification.commentId}`
        : "yorumlar"
    }`;
  }

  return `/gonderi/${notification.postId}?${searchParams.toString()}`;
}

export default function CampusNotifications() {
  const [activeFilter, setActiveFilter] =
    useState<NotificationFilter>("all");
  const {
    isHydrated,
    readIds,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useCampusNotificationStore();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { showToast } = useFeedback();

  const mentionCount = useMemo(
    () =>
      campusNotifications.filter((notification) =>
        mentionKinds.has(notification.kind),
      ).length,
    [],
  );

  const visibleNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return campusNotifications.filter(
        (notification) => !readIds.has(notification.id),
      );
    }

    if (activeFilter === "mentions") {
      return campusNotifications.filter((notification) =>
        mentionKinds.has(notification.kind),
      );
    }

    return campusNotifications;
  }, [activeFilter, readIds]);

  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      return;
    }

    const readCount = markAllAsRead();
    showToast({
      message: `${readCount} bildirim okundu olarak işaretlendi.`,
      tone: "success",
    });
  };

  const getFilterCount = (filter: NotificationFilter) => {
    if (filter === "unread") {
      return unreadCount;
    }

    if (filter === "mentions") {
      return mentionCount;
    }

    return campusNotifications.length;
  };

  return (
    <section
      aria-labelledby="notifications-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#ff7a45] sm:text-[11px]">
              Güncellemeler
            </p>
            <h1
              ref={titleRef}
              id="notifications-title"
              tabIndex={-1}
              className="mt-0.5 truncate text-lg font-black tracking-[-0.04em] outline-none sm:text-xl"
            >
              Bildirimler
            </h1>
          </div>

          <button
            type="button"
            disabled={!isHydrated || unreadCount === 0}
            onClick={handleMarkAllAsRead}
            aria-label="Tüm bildirimleri okundu olarak işaretle"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center justify-self-end gap-1.5 px-1.5 text-[11px] font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 disabled:cursor-not-allowed disabled:opacity-38 sm:px-3 sm:text-xs ${focusRing}`}
          >
            <ReadAllIcon />
            <span className="hidden min-[460px]:inline">Tümünü oku</span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Bildirimleri filtrele"
          className="grid grid-cols-3 border-t border-white/10 px-2 py-2 sm:px-5"
        >
          {filterOptions.map((filter) => {
            const isActive = activeFilter === filter.id;
            const count = getFilterCount(filter.id);

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(filter.id)}
                className={`relative min-h-11 px-2 text-[11px] font-black transition-colors sm:text-xs ${focusRing} ${
                  isActive
                    ? "bg-[#ff7a45]/12 text-[#ff7a45]"
                    : "text-white/55 hover:bg-white/8 hover:text-white"
                }`}
              >
                {filter.label}
                <span
                  aria-label={`${count} bildirim`}
                  className={`ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                    isActive
                      ? "bg-[#ff7a45] text-[#12100e]"
                      : "bg-white/10 text-white/55"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {!isHydrated ? (
        <NotificationsLoading />
      ) : visibleNotifications.length > 0 ? (
        <div
          id="notifications-list"
          role="region"
          aria-label={`${
            filterOptions.find((filter) => filter.id === activeFilter)?.label
          } bildirimleri`}
        >
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {visibleNotifications.length} bildirim gösteriliyor,
            {unreadCount} tanesi okunmamış.
          </p>

          <ol>
            {visibleNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isRead={readIds.has(notification.id)}
                onMarkAsRead={markAsRead}
              />
            ))}
          </ol>
        </div>
      ) : (
        <NotificationsEmptyState filter={activeFilter} />
      )}
    </section>
  );
}

function NotificationItem({
  notification,
  isRead,
  onMarkAsRead,
}: {
  notification: CampusNotification;
  isRead: boolean;
  onMarkAsRead: (notificationId: string) => void;
}) {
  const label = `${notification.actor.name} ${notification.action}`;
  const targetLabel =
    notification.kind === "follow" ? "Profili aç." : "Gönderiyi aç.";

  return (
    <li
      className={`relative border-b border-white/10 transition-colors last:border-b-0 ${
        isRead
          ? "bg-transparent"
          : "bg-[#ff7a45]/[0.065]"
      }`}
    >
      {!isRead && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-[#ff7a45]"
        />
      )}

      <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <CampusAuthorAvatar
          author={notification.actor.name}
          authorId={notification.actor.id}
          size="md"
          className="mt-0.5"
        />

        <Link
          href={getNotificationHref(notification)}
          onClick={() => onMarkAsRead(notification.id)}
          aria-label={`${label} ${notification.preview}. ${notification.time} önce. ${targetLabel}`}
          className={`min-w-0 rounded-sm ${focusRing}`}
        >
          <p className="text-sm leading-5.5">
            <span className="font-black">{notification.actor.name}</span>{" "}
            <span className="font-medium text-white/70">
              {notification.action}
            </span>
          </p>
          <p
            className={`mt-1 line-clamp-2 text-sm leading-5.5 ${
              isRead
                ? "text-white/55"
                : "font-semibold text-white/80"
            }`}
          >
            {notification.preview}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#ff7a45]/80">
            {notification.postTitle && (
              <>
                <span className="max-w-full truncate">
                  {notification.postTitle}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time>{notification.time}</time>
          </p>
        </Link>

        <div className="flex min-w-10 flex-col items-end gap-1">
          <NotificationKindIcon kind={notification.kind} />
          {!isRead && (
            <>
              <span className="sr-only">Okunmamış bildirim.</span>
              <button
                type="button"
                onClick={() => onMarkAsRead(notification.id)}
                aria-label={`${notification.actor.name} bildirimini okundu olarak işaretle`}
                className={`grid size-10 place-items-center rounded-full text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/10 hover:text-[#ffb18c] ${focusRing}`}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-current"
                />
              </button>
            </>
          )}
        </div>
      </article>
    </li>
  );
}

function NotificationsLoading() {
  return (
    <div
      role="status"
      aria-label="Bildirimler yükleniyor"
      className="divide-y divide-white/10"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex animate-pulse items-start gap-3 px-4 py-5 motion-reduce:animate-none sm:px-6"
        >
          <span className="size-10 shrink-0 rounded-full bg-white/8" />
          <span className="min-w-0 flex-1 space-y-2 pt-0.5">
            <span className="block h-3.5 w-3/4 rounded-full bg-white/8" />
            <span className="block h-3.5 w-full rounded-full bg-white/6" />
            <span className="block h-2.5 w-2/5 rounded-full bg-white/6" />
          </span>
        </div>
      ))}
      <span className="sr-only">Bildirimler yükleniyor…</span>
    </div>
  );
}

function NotificationsEmptyState({
  filter,
}: {
  filter: NotificationFilter;
}) {
  const content =
    filter === "unread"
      ? {
          title: "Hepsini gördün",
          description:
            "Yeni bir yorum, beğeni veya yanıttan haberdar olduğunda burada görünecek.",
        }
      : filter === "mentions"
        ? {
            title: "Henüz senden bahseden yok",
            description:
              "Birisi seni bir yorumda etiketlediğinde veya yanıtladığında burada göreceksin.",
          }
        : {
            title: "Bildirim kutun sessiz",
            description:
              "Topluluktaki etkileşimlerin ve önemli KAMPÜS duyuruları burada toplanacak.",
          };

  return (
    <div className="grid min-h-[28rem] place-items-center px-5 py-14 text-center sm:px-8">
      <div className="max-w-sm">
        <span
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/12 text-[#ff7a45]"
        >
          <BellIcon />
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          {content.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {content.description}
        </p>
      </div>
    </div>
  );
}

function NotificationKindIcon({
  kind,
}: {
  kind: CampusNotificationKind;
}) {
  const labelByKind: Record<CampusNotificationKind, string> = {
    like: "Beğeni",
    comment: "Yorum",
    reply: "Yanıt",
    mention: "Bahsetme",
    follow: "Takip",
    announcement: "Duyuru",
  };

  return (
    <span
      role="img"
      aria-label={labelByKind[kind]}
      className="grid size-8 place-items-center rounded-full bg-white/8 text-[#ff7a45]"
    >
      {kind === "like" ? (
        <HeartIcon />
      ) : kind === "follow" ? (
        <PersonPlusIcon />
      ) : kind === "announcement" ? (
        <MegaphoneIcon />
      ) : kind === "mention" ? (
        <MentionIcon />
      ) : (
        <CommentIcon />
      )}
    </span>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-5"
    >
      <path
        d="M5.1 8.2a4.9 4.9 0 0 1 9.8 0c0 5 1.8 5.4 1.8 5.4H3.3s1.8-.4 1.8-5.4Zm2.9 7.4a2.2 2.2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReadAllIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[17px]"
    >
      <path
        d="m3 10 3 3 5-6m-1 5 2 2 5-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="M10 16.2s-6-3.4-6-8.1A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.1c0 4.7-6 8.1-6 8.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonPlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <circle
        cx="8"
        cy="6.5"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.7 15.8c.4-3 2-4.5 4.3-4.5s3.9 1.5 4.3 4.5M15.2 7.3v5M12.7 9.8h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="M16.3 9.1c0 3.4-2.8 6-6.3 6a7 7 0 0 1-2.3-.4L4 16l1.1-3A5.8 5.8 0 0 1 3.7 9.1c0-3.4 2.8-6.1 6.3-6.1s6.3 2.7 6.3 6.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MentionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="M13.1 7.3v4a1.8 1.8 0 1 0 3.6 0V10a6.7 6.7 0 1 0-2.6 5.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="10"
        cy="10"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="M4 8.2v3.6h2.3l5.5 3.2V5L6.3 8.2H4Zm2.5 3.6.7 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 7.2a4 4 0 0 1 0 5.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
