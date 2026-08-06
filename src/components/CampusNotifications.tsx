"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { campusButton } from "@/components/campusButtonStyles";
import { useCampusNotifications } from "@/components/CampusNotificationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { getNotificationCopy } from "@/notifications/copy";
import type {
  NotificationDto,
  NotificationKindDto,
} from "@/notifications/client";

type NotificationFilter = "all" | "unread" | "mentions";

const mentionKinds = new Set<NotificationKindDto>(["mention", "reply"]);
const commentTargetKinds = new Set<NotificationKindDto>([
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

const relativeTimeFormatter = new Intl.RelativeTimeFormat("tr-TR", {
  numeric: "auto",
});

function formatRelativeTime(isoDate: string) {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  const elapsedMinutes = Math.round(elapsedMs / 60_000);

  if (elapsedMinutes < 1) {
    return "Az önce";
  }
  if (elapsedMinutes < 60) {
    return relativeTimeFormatter.format(-elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return relativeTimeFormatter.format(-elapsedHours, "hour");
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  if (elapsedDays < 7) {
    return relativeTimeFormatter.format(-elapsedDays, "day");
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
  }).format(new Date(isoDate));
}

/** Gün başlangıcı: yerel saat diliminde 00:00. */
function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

type NotificationDateGroupId = "today" | "yesterday" | "week" | "older";

const dateGroupLabels: Record<NotificationDateGroupId, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu hafta",
  older: "Daha eski",
};

/**
 * Bildirimleri okunma durumuna değil tarihe göre gruplar. Liste zaten
 * `createdAt` azalan sırayla geldiği için her kova kendi içinde de
 * kronolojik kalır.
 */
function groupNotificationsByDate(notifications: NotificationDto[]) {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const buckets: Record<NotificationDateGroupId, NotificationDto[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const notification of notifications) {
    const createdAt = startOfLocalDay(new Date(notification.createdAt));

    if (createdAt.getTime() === today.getTime()) {
      buckets.today.push(notification);
    } else if (createdAt.getTime() === yesterday.getTime()) {
      buckets.yesterday.push(notification);
    } else if (createdAt.getTime() >= weekStart.getTime()) {
      buckets.week.push(notification);
    } else {
      buckets.older.push(notification);
    }
  }

  return (["today", "yesterday", "week", "older"] as const)
    .map((id) => ({ id, label: dateGroupLabels[id], items: buckets[id] }))
    .filter((group) => group.items.length > 0);
}

function getNotificationHref(notification: NotificationDto) {
  if (notification.kind === "follow") {
    return `/profil/${encodeURIComponent(notification.actor.username)}`;
  }

  if (!notification.post) {
    return "/bildirimler";
  }

  const searchParams = new URLSearchParams({
    bildirim: notification.id,
  });

  if (commentTargetKinds.has(notification.kind) && notification.comment) {
    searchParams.set("hedef", "yorum");
    searchParams.set("yorum", notification.comment.id);
    return `/gonderi/${notification.post.id}?${searchParams.toString()}#yorum-${notification.comment.id}`;
  }

  return `/gonderi/${notification.post.id}?${searchParams.toString()}`;
}

export default function CampusNotifications() {
  const [activeFilter, setActiveFilter] =
    useState<NotificationFilter>("all");
  const {
    notifications,
    isNotificationsHydrated,
    hasMoreNotifications,
    isLoadingMoreNotifications,
    loadMoreNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useCampusNotifications();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { showToast } = useFeedback();

  const mentionCount = useMemo(
    () =>
      notifications.filter((notification) => mentionKinds.has(notification.kind))
        .length,
    [notifications],
  );

  const visibleNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((notification) => !notification.isRead);
    }

    if (activeFilter === "mentions") {
      return notifications.filter((notification) =>
        mentionKinds.has(notification.kind),
      );
    }

    return notifications;
  }, [activeFilter, notifications]);

  const notificationSections = useMemo(
    () => groupNotificationsByDate(visibleNotifications),
    [visibleNotifications],
  );

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    // Rozetler ve okunmadı vurguları ekranda temizlendiği için toast yok.
    await markAllAsRead();
  };

  const getFilterCount = (filter: NotificationFilter) => {
    if (filter === "unread") {
      return unreadCount;
    }

    if (filter === "mentions") {
      return mentionCount;
    }

    return notifications.length;
  };

  return (
    <section
      aria-labelledby="notifications-title"
      aria-busy={!isNotificationsHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
          <h1
            ref={titleRef}
            id="notifications-title"
            tabIndex={-1}
            className="truncate text-xl font-black tracking-[-0.03em] outline-none sm:text-2xl"
          >
            Bildirimler
          </h1>

          <button
            type="button"
            disabled={!isNotificationsHydrated || unreadCount === 0}
            onClick={() => void handleMarkAllAsRead()}
            aria-label="Tüm bildirimleri okundu olarak işaretle"
            className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 disabled:cursor-not-allowed disabled:opacity-38 sm:px-3 sm:text-sm ${focusRing}`}
          >
            <ReadAllIcon />
            <span className="hidden min-[460px]:inline">Tümünü oku</span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Bildirimleri filtrele"
          className="grid grid-cols-3 border-t border-white/8 px-4 sm:px-6"
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
                className={`relative flex min-h-10 items-center justify-center gap-1.5 border-b-2 text-xs font-black transition-colors sm:text-sm ${focusRing} ${
                  isActive
                    ? "border-[#ff7a45] text-[#ff7a45]"
                    : "border-transparent text-white/55 hover:text-white"
                }`}
              >
                {filter.label}
                <span
                  aria-label={`${count} bildirim`}
                  className={`inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                    isActive
                      ? "bg-[#ff7a45]/14 text-[#ff7a45]"
                      : "bg-white/8 text-white/50"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {!isNotificationsHydrated ? (
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

          {notificationSections.map((section) => (
            <section key={section.id} aria-labelledby={`notifications-${section.id}`}>
              {notificationSections.length > 1 && (
                <h2
                  id={`notifications-${section.id}`}
                  className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-white/40 sm:px-6"
                >
                  {section.label}
                </h2>
              )}
              <ol>
                {section.items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))}
              </ol>
            </section>
          ))}

          {hasMoreNotifications && (
            <div className="px-4 py-5 text-center sm:px-6">
              <button
                type="button"
                aria-label="Daha fazla bildirim yükle"
                aria-busy={isLoadingMoreNotifications}
                disabled={isLoadingMoreNotifications}
                onClick={() =>
                  void loadMoreNotifications().catch(() => {
                    showToast({
                      message: "Bildirimler yüklenemedi. Tekrar dene.",
                      tone: "error",
                    });
                  })
                }
                className={campusButton.secondary}
              >
                {isLoadingMoreNotifications
                  ? "Bildirimler yükleniyor…"
                  : "Daha fazla bildirim yükle"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <NotificationsEmptyState filter={activeFilter} />
      )}
    </section>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: NotificationDto;
  onMarkAsRead: (notificationId: string) => Promise<void>;
}) {
  const copy = getNotificationCopy(notification);
  const isRead = notification.isRead;
  const targetLabel =
    notification.kind === "follow" ? "Profili aç." : "Gönderiyi aç.";
  const time = formatRelativeTime(notification.createdAt);

  return (
    <li className="border-b border-white/5 last:border-b-0">
      <Link
        href={getNotificationHref(notification)}
        onClick={() => void onMarkAsRead(notification.id)}
        aria-label={`${copy.actorLabel} ${copy.action} ${copy.preview}. ${
          isRead ? "" : "Okunmamış. "
        }${time}. ${targetLabel}`}
        className={`flex min-h-19 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/3 sm:px-6 ${focusRing}`}
      >
        <span className="relative shrink-0">
          <CampusAuthorAvatar
            author={`@${notification.actor.username}`}
            authorId={notification.actor.id}
            avatarUrl={notification.actor.avatarUrl}
            size="md"
          />
          <NotificationKindIcon kind={notification.kind} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm sm:text-[15px]">
            <span className="font-black">{copy.actorLabel}</span>{" "}
            <span className="font-medium text-white/65">{copy.action}</span>
          </span>
          {copy.preview && (
            <span
              className={`mt-0.5 block truncate text-sm ${
                isRead ? "text-white/45" : "text-white/62"
              }`}
            >
              {copy.preview}
            </span>
          )}
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <time
            dateTime={notification.createdAt}
            className="text-xs text-white/45"
          >
            {time}
          </time>
          {!isRead && (
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#ff7a45]"
            />
          )}
        </span>
      </Link>
    </li>
  );
}

function NotificationsLoading() {
  return (
    <div
      role="status"
      aria-label="Bildirimler yükleniyor"
      className="divide-y divide-white/5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex animate-pulse items-center gap-3 px-4 py-3 motion-reduce:animate-none sm:px-6"
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
            title: "Henüz bildirim yok",
            description:
              "Yeni etkileşimlerin ve önemli kampüs duyuruların burada görünecek.",
          };

  return (
    <div className="flex flex-col items-center px-6 pt-14 pb-10 text-center">
      <div className="max-w-88">
        <span
          aria-hidden="true"
          className="mx-auto grid size-11 place-items-center rounded-full border border-white/10 text-[#ff7a45]"
        >
          <HeartIcon className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-black tracking-[-0.03em]">
          {content.title}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-white/55">
          {content.description}
        </p>
      </div>
    </div>
  );
}

function NotificationKindIcon({ kind }: { kind: NotificationKindDto }) {
  const labelByKind: Record<NotificationKindDto, string> = {
    like: "Beğeni",
    comment: "Yorum",
    reply: "Yanıt",
    mention: "Bahsetme",
    follow: "Takip",
    announcement: "Duyuru",
  };

  // Avatarın sağ alt köşesine oturan küçük tür rozeti; kart ağırlığı
  // katmadan bildirimin türünü tek bakışta gösterir.
  return (
    <span
      role="img"
      aria-label={labelByKind[kind]}
      className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-[#12151d] text-[#ff7a45] ring-2 ring-[#0a0d16]"
    >
      {kind === "like" ? (
        <HeartIcon className="size-2.5" />
      ) : kind === "follow" ? (
        <PersonPlusIcon className="size-2.5" />
      ) : kind === "announcement" ? (
        <HeartIcon className="size-2.5" />
      ) : kind === "mention" ? (
        <MentionIcon className="size-2.5" />
      ) : (
        <CommentIcon className="size-2.5" />
      )}
    </span>
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

function HeartIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
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

function PersonPlusIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
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

function CommentIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
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

function MentionIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
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

