"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
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

  // Okunmamışlar üstte ayrı blokta dursun; geri dönen kullanıcı neyi
  // kaçırdığını tek bakışta görsün.
  const notificationSections = useMemo(() => {
    const unread = visibleNotifications.filter((item) => !item.isRead);
    const read = visibleNotifications.filter((item) => item.isRead);

    return [
      { id: "unread", label: "Yeni", items: unread },
      { id: "read", label: "Daha önce", items: read },
    ].filter((section) => section.items.length > 0);
  }, [visibleNotifications]);

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    const readCount = await markAllAsRead();
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

    return notifications.length;
  };

  return (
    <section
      aria-labelledby="notifications-title"
      aria-busy={!isNotificationsHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#ff7a45] sm:text-xs">
              Güncellemeler
            </p>
            <h1
              ref={titleRef}
              id="notifications-title"
              tabIndex={-1}
              className="mt-0.5 truncate text-2xl font-black tracking-[-0.04em] outline-none sm:text-3xl"
            >
              Bildirimler
            </h1>
          </div>

          <button
            type="button"
            disabled={!isNotificationsHydrated || unreadCount === 0}
            onClick={() => void handleMarkAllAsRead()}
            aria-label="Tüm bildirimleri okundu olarak işaretle"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center justify-self-end gap-1.5 px-1.5 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 disabled:cursor-not-allowed disabled:opacity-38 sm:px-3 sm:text-sm ${focusRing}`}
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
                className={`relative min-h-12 px-2 text-xs font-black transition-colors sm:text-sm ${focusRing} ${
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
                  className="border-b border-white/8 bg-white/[0.02] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.13em] text-white/62 sm:px-6"
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
                className={`inline-flex min-h-12 items-center justify-center border border-white/12 bg-white/[0.035] px-5 text-sm font-black text-white transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
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
    <li
      className={`relative border-b border-white/10 transition-colors last:border-b-0 ${
        isRead ? "bg-transparent" : "bg-[#ff7a45]/[0.065]"
      }`}
    >
      {!isRead && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-[#ff7a45]"
        />
      )}

      <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3.5 px-4 py-5 sm:px-6 sm:py-6">
        {/* Gruplanan beğenilerde yığılmış avatar: kimlerin beğendiği tek
            bakışta görünsün. */}
        <span className="mt-0.5 flex shrink-0 items-center -space-x-3">
          <CampusAuthorAvatar
            author={`@${notification.actor.username}`}
            authorId={notification.actor.id}
            avatarUrl={notification.actor.avatarUrl}
            size="md"
            className="ring-2 ring-[#0a0d16]"
          />
          {notification.otherActors.slice(0, 2).map((actor) => (
            <CampusAuthorAvatar
              key={actor.id}
              author={`@${actor.username}`}
              authorId={actor.id}
              avatarUrl={actor.avatarUrl}
              size="sm"
              className="ring-2 ring-[#0a0d16]"
            />
          ))}
        </span>

        <Link
          href={getNotificationHref(notification)}
          onClick={() => void onMarkAsRead(notification.id)}
          aria-label={`${copy.actorLabel} ${copy.action} ${copy.preview}. ${time}. ${targetLabel}`}
          className={`min-w-0 rounded-sm ${focusRing}`}
        >
          <p className="text-[15px] leading-6 sm:text-base">
            <span className="font-black">{copy.actorLabel}</span>{" "}
            <span className="font-medium text-white/70">{copy.action}</span>
          </p>
          <p
            className={`mt-1 line-clamp-2 text-[15px] leading-6 sm:text-base ${
              isRead ? "text-white/55" : "font-semibold text-white/80"
            }`}
          >
            {copy.preview}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#ff7a45]/80">
            {copy.postTitle && (
              <>
                <span className="max-w-full truncate">{copy.postTitle}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time dateTime={notification.createdAt}>{time}</time>
          </p>
        </Link>

        <div className="flex min-w-10 flex-col items-end gap-1">
          <NotificationKindIcon kind={notification.kind} />
          {!isRead && (
            <>
              <span className="sr-only">Okunmamış bildirim.</span>
              <button
                type="button"
                onClick={() => void onMarkAsRead(notification.id)}
                aria-label={`${copy.actorLabel} bildirimini okundu olarak işaretle`}
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

function NotificationKindIcon({ kind }: { kind: NotificationKindDto }) {
  const labelByKind: Record<NotificationKindDto, string> = {
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
