"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { campusButton } from "@/components/campusButtonStyles";
import { useCampusNotifications } from "@/components/CampusNotificationProvider";
import { useActionStatus } from "@/components/useActionStatus";
import { getNotificationCopy } from "@/notifications/copy";
import type {
  NotificationDto,
  NotificationKindDto,
} from "@/notifications/client";

const commentTargetKinds = new Set<NotificationKindDto>([
  "comment",
  "mention",
  "reply",
]);
const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

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

function formatCompactRelativeTime(isoDate: string) {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  const elapsedMinutes = Math.round(elapsedMs / 60_000);

  if (elapsedMinutes < 1) return "şimdi";
  if (elapsedMinutes < 60) return `${elapsedMinutes} dk`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} sa`;

  const elapsedDays = Math.round(elapsedHours / 24);
  if (elapsedDays === 1) return "dün";
  if (elapsedDays < 7) return `${elapsedDays} gün`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
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
  const hasRequestedAutoRead = useRef(false);
  const [loadMoreStatus, setLoadMoreStatus] = useActionStatus();

  useEffect(() => {
    if (unreadCount === 0) {
      hasRequestedAutoRead.current = false;
      return;
    }

    if (!hasRequestedAutoRead.current) {
      hasRequestedAutoRead.current = true;
      void markAllAsRead();
    }
  }, [markAllAsRead, unreadCount]);

  const notificationSections = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications],
  );

  return (
    <section
      aria-labelledby="notifications-title"
      aria-busy={!isNotificationsHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-canvas text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/8 bg-canvas/94 backdrop-blur-xl">
        <div className="flex min-h-16 items-center px-4 sm:px-5">
          <h1
            ref={titleRef}
            id="notifications-title"
            tabIndex={-1}
            className="truncate text-[22px] font-black tracking-[-0.045em] outline-none sm:text-2xl"
          >
            Bildirimler
          </h1>
        </div>

      </header>

      {!isNotificationsHydrated ? (
        <NotificationsLoading />
      ) : notifications.length > 0 ? (
        <div
          id="notifications-list"
          role="region"
          aria-label="Bildirimler"
        >
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {notifications.length} bildirim gösteriliyor,
            {unreadCount} tanesi okunmamış.
          </p>

          {notificationSections.map((section) => (
            <section key={section.id} aria-labelledby={`notifications-${section.id}`}>
              <div className="flex items-center gap-3 px-3 pt-5 pb-2 sm:px-5">
                <h2
                  id={`notifications-${section.id}`}
                  className="shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-white/48"
                >
                  {section.label}
                </h2>
                <span aria-hidden="true" className="h-px flex-1 bg-white/8" />
              </div>
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
                    setLoadMoreStatus({
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
              {loadMoreStatus && (
                <ActionStatusText status={loadMoreStatus} className="mt-2" />
              )}
            </div>
          )}
        </div>
      ) : (
        <NotificationsEmptyState />
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
  const compactTime = formatCompactRelativeTime(notification.createdAt);

  return (
    <li className="mx-2 mb-1.5 overflow-hidden rounded-2xl sm:mx-3">
      <Link
        href={getNotificationHref(notification)}
        onClick={() => void onMarkAsRead(notification.id)}
        aria-label={`${copy.actorLabel} ${copy.action} ${copy.preview}. ${
          isRead ? "" : "Okunmamış. "
        }${time}. ${targetLabel}`}
        className={`group relative flex min-h-20 items-start gap-3 px-3 py-3.5 transition-colors sm:px-4 ${focusRing} ${
          isRead
            ? "bg-white/[0.025] hover:bg-white/[0.045]"
            : "bg-brand/8 hover:bg-brand/12"
        }`}
      >
        <span className="relative shrink-0">
          <CampusAuthorAvatar
            author={`@${notification.actor.username}`}
            authorId={notification.actor.id}
            avatarUrl={notification.actor.avatarUrl}
            size="lg"
          />
          <NotificationKindBadge kind={notification.kind} />
        </span>

        <span className="min-w-0 flex-1 pt-0.5">
          <span
            data-notification-copy
            className="block text-[14px] leading-5 sm:text-[15px]"
          >
            <span className="font-black">{copy.actorLabel}</span>{" "}
            <span className="font-medium text-white/62">{copy.action}</span>
          </span>

          {/* Gönderi metni bildirimin asıl içeriği; 11px ve %38 opaklıkta
              okunmuyordu. Zaman ve "Yeni" ayrı satıra indi ki önizleme tam
              genişliği kullansın. */}
          {copy.preview && (
            <span
              className={`mt-1.5 block min-w-0 line-clamp-2 text-[13px] leading-5 ${
                isRead ? "text-white/60" : "text-white/82"
              }`}
            >
              {copy.preview}
            </span>
          )}

          <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 font-semibold">
            <time
              dateTime={notification.createdAt}
              title={time}
              className="shrink-0 text-white/45"
            >
              {compactTime}
            </time>
            {!isRead && (
              <>
                <span aria-hidden="true" className="shrink-0 text-white/30">
                  ·
                </span>
                <span className="shrink-0 font-black text-brand">Yeni</span>
              </>
            )}
          </span>
        </span>

        <NotificationTargetPreview notification={notification} />
      </Link>
    </li>
  );
}

function NotificationKindBadge({ kind }: { kind: NotificationKindDto }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-canvas bg-brand text-[#101012] shadow-sm"
    >
      {kind === "like" ? (
        <HeartIcon className="size-3" />
      ) : kind === "follow" ? (
        <PersonBadgeIcon />
      ) : kind === "mention" ? (
        <span className="text-[10px] font-black leading-none">@</span>
      ) : kind === "announcement" ? (
        <span className="text-[10px] font-black leading-none">!</span>
      ) : (
        <CommentBadgeIcon />
      )}
    </span>
  );
}

function NotificationTargetPreview({
  notification,
}: {
  notification: NotificationDto;
}) {
  if (notification.kind === "follow") {
    return (
      <span className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-brand px-3 text-[11px] font-black text-[#101012] transition-transform group-hover:scale-[1.02] sm:min-h-10 sm:px-4 sm:text-xs">
        Profil
      </span>
    );
  }

  // Gönderi için sağda küçük resim yok: gerçek görseli değil, tarama desenli
  // sahte bir kutu gösteriyordu. Bilgi taşımayan bu blok yerine satırın kendi
  // önizleme metni okunuyor.
  return null;
}

function PersonBadgeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
      <circle cx="6" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 12c.35-2.05 1.55-3.1 3.25-3.1s2.9 1.05 3.25 3.1M11.5 5.5v4M9.5 7.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentBadgeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
      <path
        d="M3 3.5h10v7H7l-3 2v-2H3v-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NotificationsLoading() {
  return (
    <div
      role="status"
      aria-label="Bildirimler yükleniyor"
      className="pt-12"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="mx-2 mb-1.5 flex min-h-[5.65rem] animate-pulse items-center gap-3 rounded-[1.25rem] bg-white/[0.025] px-3 py-3 motion-reduce:animate-none sm:mx-3 sm:px-4"
        >
          <span className="size-12 shrink-0 rounded-full bg-white/8" />
          <span className="min-w-0 flex-1 space-y-2 pt-0.5">
            <span className="block h-3.5 w-3/4 rounded-full bg-white/8" />
            <span className="block h-3.5 w-full rounded-full bg-white/6" />
            <span className="block h-2.5 w-2/5 rounded-full bg-white/6" />
          </span>
          <span className="size-14 shrink-0 rounded-xl bg-white/6" />
        </div>
      ))}
      <span className="sr-only">Bildirimler yükleniyor…</span>
    </div>
  );
}

function NotificationsEmptyState() {
  const content = {
    title: "Henüz bildirim yok",
    description:
      "Yeni etkileşimlerin ve önemli kampüs duyuruların burada görünecek.",
  };

  return (
    <div className="flex flex-col items-center px-6 pt-14 pb-10 text-center">
      <div className="max-w-88">
        <span
          aria-hidden="true"
          className="mx-auto grid size-11 place-items-center rounded-full border border-white/10 text-brand"
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
