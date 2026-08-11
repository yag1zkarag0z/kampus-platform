"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { AuthClientError } from "@/auth/client";
import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusEmojiPicker from "@/components/CampusEmojiPicker";
import CampusMessageReportDialog from "@/components/CampusMessageReportDialog";
import { useCampusMessaging } from "@/components/CampusMessagingProvider";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import { useCampusRealtime } from "@/components/CampusRealtimeProvider";
import { campusButton, campusFocusRing } from "@/components/campusButtonStyles";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
import { useDebouncedValue } from "@/components/useCampusPostQuery";
import {
  guestDirectConversations,
  type GuestDirectConversation,
} from "@/data/campusMessages";
import {
  deleteDirectMessage,
  getDirectConversation,
  listDirectConversations,
  listDirectMessages,
  markDirectConversationRead,
  resolveDirectMessageRequest,
  sendDirectMessage,
  startDirectConversation,
  type DirectConversationDto,
  type DirectMessageDto,
} from "@/messaging/client";
import { searchMembers, type FollowMemberDto } from "@/social/client";

const THREAD_POLL_INTERVAL_MS = 6_000;
const CONVERSATION_POLL_INTERVAL_MS = 15_000;
const REALTIME_SAFETY_POLL_INTERVAL_MS = 60_000;
const TYPING_IDLE_TIMEOUT_MS = 1_800;
const TYPING_REFRESH_INTERVAL_MS = 1_200;
const REMOTE_TYPING_EXPIRY_MS = 4_000;

const compactDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});
const listDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
});
const messageDayFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;

type ThreadMessage = DirectMessageDto & {
  deliveryStatus: "sent" | "sending" | "failed";
  clientMessageId?: string;
};

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  return isSameDay(date, now)
    ? compactDateFormatter.format(date)
    : listDateFormatter.format(date);
}

function sortMessages<TMessage extends DirectMessageDto>(messages: TMessage[]) {
  return [...messages].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime() ||
      first.id.localeCompare(second.id, "en"),
  );
}

function mergeMessages<TMessage extends DirectMessageDto>(
  current: TMessage[],
  incoming: TMessage[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return sortMessages([...byId.values()]);
}

function toThreadMessages(messages: DirectMessageDto[]): ThreadMessage[] {
  return messages.map((message) => ({
    ...message,
    deliveryStatus: "sent",
  }));
}

function messageDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Bugün";
  if (isSameDay(date, yesterday)) return "Dün";
  return messageDayFormatter.format(date);
}

function belongsToMessageGroup(
  message: ThreadMessage,
  adjacent?: ThreadMessage,
) {
  if (!adjacent || message.isDeleted || adjacent.isDeleted) return false;
  return (
    message.isMine === adjacent.isMine &&
    messageDayKey(message.createdAt) === messageDayKey(adjacent.createdAt) &&
    Math.abs(
      new Date(message.createdAt).getTime() -
        new Date(adjacent.createdAt).getTime(),
    ) <= MESSAGE_GROUP_WINDOW_MS
  );
}

function mergeConversation(
  current: DirectConversationDto[],
  incoming: DirectConversationDto,
) {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)];
}

function mergeConversationPage(
  current: DirectConversationDto[],
  incoming: DirectConversationDto[],
  prepend = false,
) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  const remaining = current.filter((item) => !incomingIds.has(item.id));
  return prepend ? [...incoming, ...remaining] : [...remaining, ...incoming];
}

function TypingIndicator({
  displayName,
  memberId,
  avatarUrl,
}: {
  displayName: string;
  memberId: string;
  avatarUrl: string | null;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${displayName} yaziyor`}
      className="pointer-events-none sticky bottom-0 z-10 mt-2 flex items-end gap-2 pb-1"
    >
      <CampusAuthorAvatar
        author={displayName}
        authorId={memberId}
        avatarUrl={avatarUrl}
        size="sm"
      />
      <span className="flex min-h-9 min-w-12 items-center justify-center rounded-[1.15rem] rounded-bl-[0.38rem] border border-white/10 bg-[#1b1b1f] px-3 shadow-lg shadow-black/20">
        <span aria-hidden="true" className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1 animate-pulse rounded-full bg-white/48 motion-reduce:animate-none"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

export default function CampusMessages() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionMode, retrySession } = useCampusAccount();
  const { markGuestMessagesRead, refreshUnreadMessageCount } =
    useCampusMessaging();
  const { status: realtimeStatus, subscribe: subscribeRealtime } =
    useCampusRealtime();
  const isRealtimeConnected = realtimeStatus === "connected";
  const [conversations, setConversations] = useState<DirectConversationDto[]>([]);
  const [messageRequests, setMessageRequests] = useState<DirectConversationDto[]>([]);
  const [openedConversation, setOpenedConversation] =
    useState<DirectConversationDto | null>(null);
  const [activeBox, setActiveBox] = useState<"inbox" | "requests">("inbox");
  const [inboxCursor, setInboxCursor] = useState<string | null>(null);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingMoreBox, setLoadingMoreBox] = useState<
    "inbox" | "requests" | null
  >(null);
  const [isLoading, setIsLoading] = useState(sessionMode === "member");
  const [hasFailed, setHasFailed] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const debouncedConversationSearch = useDebouncedValue(
    conversationSearch,
    250,
  ).trim();
  const [startStatus, setStartStatus] = useActionStatus();
  const startedUsernameRef = useRef<string | null>(null);
  const conversationId = searchParams.get("sohbet");
  const requestedUsername = searchParams.get("kullanici")?.trim() ?? "";
  const selectedConversation = useMemo(
    () => {
      if (!conversationId) return null;
      return (
        [...conversations, ...messageRequests].find(
          (item) => item.id === conversationId,
        ) ??
        (openedConversation?.id === conversationId
          ? openedConversation
          : null)
      );
    },
    [conversationId, conversations, messageRequests, openedConversation],
  );
  const visibleConversations =
    activeBox === "requests" ? messageRequests : conversations;
  const visibleCursor =
    activeBox === "requests" ? requestCursor : inboxCursor;

  useEffect(() => {
    if (sessionMode === "guest") {
      markGuestMessagesRead();
    }
  }, [markGuestMessagesRead, sessionMode]);

  const refreshConversations = useCallback(async (silent = false) => {
    if (sessionMode !== "member") return;
    if (!silent) setIsLoading(true);

    try {
      const [inboxResult, requestResult] = await Promise.all([
        listDirectConversations("inbox", undefined, debouncedConversationSearch),
        listDirectConversations("requests", undefined, debouncedConversationSearch),
      ]);
      setConversations((current) =>
        silent
          ? mergeConversationPage(current, inboxResult.data, true)
          : inboxResult.data,
      );
      setMessageRequests((current) =>
        silent
          ? mergeConversationPage(current, requestResult.data, true)
          : requestResult.data,
      );
      if (!silent) {
        setInboxCursor(inboxResult.page.nextCursor);
        setRequestCursor(requestResult.page.nextCursor);
      }
      setHasFailed(false);
    } catch (error) {
      if (!silent) setHasFailed(true);
      if (error instanceof AuthClientError && error.status === 401) {
        void retrySession();
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [debouncedConversationSearch, retrySession, sessionMode]);

  useEffect(() => {
    queueMicrotask(() => void refreshConversations());

    if (sessionMode !== "member") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshConversations(true);
      }
    }, isRealtimeConnected
      ? REALTIME_SAFETY_POLL_INTERVAL_MS
      : CONVERSATION_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isRealtimeConnected, refreshConversations, sessionMode]);

  useEffect(() =>
    subscribeRealtime((event) => {
      if (event.type !== "conversation.invalidate") return;
      if (
        event.reason === "request-accepted" ||
        event.reason === "request-removed"
      ) {
        setMessageRequests((current) =>
          current.filter((item) => item.id !== event.conversationId),
        );
      }
      if (event.reason === "request-removed") {
        setConversations((current) =>
          current.filter((item) => item.id !== event.conversationId),
        );
        setOpenedConversation((current) =>
          current?.id === event.conversationId ? null : current,
        );
      }
      void refreshConversations(true);
    }),
  [refreshConversations, subscribeRealtime]);

  useEffect(() => {
    if (
      sessionMode !== "member" ||
      !requestedUsername ||
      startedUsernameRef.current === requestedUsername
    ) {
      return;
    }

    startedUsernameRef.current = requestedUsername;
    startDirectConversation(requestedUsername)
      .then((conversation) => {
        setConversations((current) =>
          mergeConversation(current, conversation),
        );
        setStartStatus(null);
        router.replace(
          `/mesajlar?sohbet=${encodeURIComponent(conversation.id)}`,
          { scroll: false },
        );
      })
      .catch((error: unknown) => {
        startedUsernameRef.current = null;
        setStartStatus({
          tone: "error",
          message:
            error instanceof AuthClientError
              ? error.message
              : "Konuşma başlatılamadı. Tekrar dene.",
        });
      });
  }, [requestedUsername, router, sessionMode, setStartStatus]);

  useEffect(() => {
    if (
      sessionMode !== "member" ||
      !conversationId ||
      selectedConversation ||
      isLoading
    ) {
      return;
    }

    getDirectConversation(conversationId)
      .then((conversation) => {
        setOpenedConversation(conversation);
        if (conversation.requestDirection === "incoming") {
          setMessageRequests((current) =>
            mergeConversation(current, conversation),
          );
          setActiveBox("requests");
        } else {
          setConversations((current) =>
            mergeConversation(current, conversation),
          );
        }
      })
      .catch(() => {
        router.replace("/mesajlar", { scroll: false });
      });
  }, [conversationId, isLoading, router, selectedConversation, sessionMode]);

  const openConversation = (conversation: DirectConversationDto) => {
    setConversationSearch("");
    setOpenedConversation(conversation);
    const updateUnread = (current: DirectConversationDto[]) =>
      current.map((item) =>
        item.id === conversation.id ? { ...item, unreadCount: 0 } : item,
      );
    setConversations(updateUnread);
    setMessageRequests(updateUnread);
    router.push(
      `/mesajlar?sohbet=${encodeURIComponent(conversation.id)}`,
      { scroll: false },
    );
  };

  const handleConversationChanged = useCallback(
    (conversation: DirectConversationDto) => {
      setOpenedConversation(conversation);
      if (conversation.requestDirection === "incoming") {
        setMessageRequests((current) =>
          mergeConversation(current, conversation),
        );
      } else {
        setMessageRequests((current) =>
          current.filter((item) => item.id !== conversation.id),
        );
        setConversations((current) =>
          mergeConversation(current, conversation),
        );
      }
    },
    [],
  );

  const handleRequestRemoved = useCallback((removedId: string) => {
    setConversations((current) =>
      current.filter((item) => item.id !== removedId),
    );
    setMessageRequests((current) =>
      current.filter((item) => item.id !== removedId),
    );
    setOpenedConversation(null);
    router.replace("/mesajlar", { scroll: false });
  }, [router]);

  const loadMoreConversations = async () => {
    if (loadingMoreBox) return;
    const cursor = activeBox === "inbox" ? inboxCursor : requestCursor;
    if (!cursor) return;

    setLoadingMoreBox(activeBox);
    try {
      const result = await listDirectConversations(
        activeBox,
        cursor,
        debouncedConversationSearch,
      );
      if (activeBox === "inbox") {
        setConversations((current) =>
          mergeConversationPage(current, result.data),
        );
        setInboxCursor(result.page.nextCursor);
      } else {
        setMessageRequests((current) =>
          mergeConversationPage(current, result.data),
        );
        setRequestCursor(result.page.nextCursor);
      }
    } catch (error) {
      setStartStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Daha eski konuşmalar yüklenemedi.",
      });
    } finally {
      setLoadingMoreBox(null);
    }
  };

  if (sessionMode === "signed-out") {
    return (
      <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-canvas px-5 text-center text-white md:min-h-svh">
        <div className="max-w-sm">
          <MessageIcon className="mx-auto size-12 text-brand" />
          <h1 className="mt-5 text-3xl font-black tracking-[-0.055em]">
            Mesajlar
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Kampüsteki kişilerle konuşmak için öğrenci hesabınla giriş yap.
          </p>
          <Link href="/giris" className={`${campusButton.primary} mt-6`}>
            Giriş yap
          </Link>
        </div>
      </section>
    );
  }

  if (sessionMode === "guest") {
    return (
      <GuestMessagesPreview
        conversationId={conversationId}
        onBack={() => router.push("/mesajlar", { scroll: false })}
        onOpen={(conversation) =>
          router.push(
            `/mesajlar?sohbet=${encodeURIComponent(conversation.id)}`,
            { scroll: false },
          )
        }
      />
    );
  }

  return (
    <section
      aria-label="Mesajlar"
      data-realtime-status={realtimeStatus}
      className="campus-messages-page h-[calc(100svh-9.5rem-env(safe-area-inset-bottom))] min-w-0 overflow-hidden bg-canvas text-white md:h-svh"
    >
      <div className="grid h-full min-h-0 md:grid-cols-[minmax(12rem,0.38fr)_minmax(0,0.62fr)]">
        <aside
          aria-label="Konuşmalar"
          className={`${selectedConversation ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col border-r border-white/10`}
        >
          <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <h1 className="text-xl font-black tracking-[-0.045em]">Mesajlar</h1>
            <button
              type="button"
              aria-label="Yeni mesaj"
              aria-expanded={isPickerOpen}
              onClick={() => setIsPickerOpen((open) => !open)}
              className={`grid size-10 place-items-center rounded-full text-white/68 transition-colors hover:bg-white/8 hover:text-white ${campusFocusRing}`}
            >
              <ComposeIcon />
            </button>
          </header>

          <div className="border-b border-white/10 px-3 py-2.5">
            <label className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 transition-colors focus-within:border-brand/38 focus-within:bg-white/[0.05]">
              <SearchIcon />
              <span className="sr-only">Konuşmalarda ara</span>
              <input
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Konuşmalarda ara"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
              {conversationSearch && (
                <button
                  type="button"
                  aria-label="Konuşma aramasını temizle"
                  onClick={() => setConversationSearch("")}
                  className={`grid size-7 place-items-center rounded-full text-white/42 hover:bg-white/8 hover:text-white ${campusFocusRing}`}
                >
                  <CloseIcon />
                </button>
              )}
            </label>
          </div>

          <nav
            aria-label="Mesaj kutuları"
            className="grid grid-cols-2 border-b border-white/10 px-2"
          >
            {(["inbox", "requests"] as const).map((box) => {
              const isActive = activeBox === box;
              const label = box === "inbox" ? "Mesajlar" : "İstekler";

              return (
                <button
                  key={box}
                  type="button"
                  onClick={() => {
                    setActiveBox(box);
                    router.replace("/mesajlar", { scroll: false });
                  }}
                  className={`relative min-h-12 px-2 text-sm font-black transition-colors ${
                    isActive ? "text-white" : "text-white/42 hover:text-white/70"
                  } ${campusFocusRing}`}
                >
                  {label}
                  {box === "requests" && messageRequests.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand/14 px-1.5 py-0.5 text-[10px] text-brand">
                      {Math.min(messageRequests.length, 99)}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-brand" />
                  )}
                </button>
              );
            })}
          </nav>

          {isPickerOpen && (
            <NewConversationPicker
              onClose={() => setIsPickerOpen(false)}
              onStarted={(conversation) => {
                setConversations((current) =>
                  mergeConversation(current, conversation),
                );
                setIsPickerOpen(false);
                openConversation(conversation);
              }}
            />
          )}

          {startStatus && (
            <ActionStatusText status={startStatus} className="mx-3 mt-3" />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <ConversationListSkeleton />
            ) : hasFailed ? (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <p className="text-sm font-bold text-white/66">
                    Konuşmalar yüklenemedi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void refreshConversations()}
                    className={`${campusButton.secondary} mt-4`}
                  >
                    Tekrar dene
                  </button>
                </div>
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <MessageIcon className="mx-auto size-10 text-white/25" />
                  <p className="mt-4 text-base font-black">
                    {debouncedConversationSearch
                      ? "Eşleşen konuşma yok"
                      : activeBox === "requests"
                        ? "Yeni mesaj isteği yok"
                        : "Henüz konuşma yok"}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-white/48">
                    {debouncedConversationSearch
                      ? "İsim, kullanıcı adı veya son mesajla tekrar ara."
                      : activeBox === "requests"
                        ? "Takip etmediğin kişilerden gelen mesajlar burada görünür."
                        : "Kampüsten birini bulup ilk mesajı gönder."}
                  </p>
                  {activeBox === "inbox" && !debouncedConversationSearch && (
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(true)}
                      className="mt-4 text-sm font-black text-brand outline-none hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      Yeni mesaj →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <ol>
                  {visibleConversations.map((conversation) => (
                    <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className={`flex min-h-[4.65rem] w-full min-w-0 items-center gap-3 border-b border-white/8 px-4 py-3 text-left outline-none transition-colors hover:bg-white/[0.045] focus-visible:bg-white/[0.06] ${
                        conversation.id === conversationId
                          ? "bg-white/[0.055]"
                          : ""
                      }`}
                    >
                      <CampusAuthorAvatar
                        author={conversation.member.displayName}
                        authorId={conversation.member.id}
                        avatarUrl={conversation.member.avatarUrl}
                        size="lg"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-black tracking-[-0.02em]">
                            {conversation.member.displayName}
                          </span>
                          {conversation.lastMessage && (
                            <time className="ml-auto shrink-0 text-[11px] font-semibold text-white/38">
                              {formatConversationTime(
                                conversation.lastMessage.createdAt,
                              )}
                            </time>
                          )}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-2">
                          <span
                            className={`truncate text-xs leading-5 ${
                              conversation.unreadCount > 0
                                ? "font-bold text-white/82"
                                : "text-white/43"
                            }`}
                          >
                            {conversation.lastMessage
                              ? `${conversation.lastMessage.isMine ? "Sen: " : ""}${conversation.lastMessage.preview}`
                              : "Yeni konuşma"}
                          </span>
                          {conversation.unreadCount > 0 && (
                            <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black text-[#101012]">
                              {Math.min(conversation.unreadCount, 99)}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    </li>
                  ))}
                </ol>
                {visibleCursor && (
                  <div className="border-t border-white/8 px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => void loadMoreConversations()}
                      disabled={loadingMoreBox !== null}
                      className="rounded-full border border-white/12 px-4 py-2 text-xs font-black text-white/62 outline-none transition-colors hover:border-white/22 hover:bg-white/[0.045] hover:text-white disabled:cursor-wait disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {loadingMoreBox === activeBox
                        ? "Yükleniyor..."
                        : "Daha eski konuşmaları göster"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <div
          className={`${selectedConversation ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}
        >
          {selectedConversation ? (
            <MessageThread
              key={selectedConversation.id}
              conversation={selectedConversation}
              onBack={() => router.push("/mesajlar", { scroll: false })}
              onConversationChanged={handleConversationChanged}
              onRequestRemoved={handleRequestRemoved}
              refreshConversations={refreshConversations}
              refreshUnreadCount={refreshUnreadMessageCount}
            />
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <div className="max-w-xs">
                <MessageIcon className="mx-auto size-12 text-white/22" />
                <h2 className="mt-5 text-2xl font-black tracking-[-0.04em]">
                  Bir konuşma seç
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/48">
                  Mesajların burada açılacak.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function GuestMessagesPreview({
  conversationId,
  onBack,
  onOpen,
}: {
  conversationId: string | null;
  onBack: () => void;
  onOpen: (conversation: GuestDirectConversation) => void;
}) {
  const [isListOpen, setIsListOpen] = useState(conversationId === null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversations, setConversations] = useState(() =>
    guestDirectConversations.map((conversation) => ({ ...conversation })),
  );
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ThreadMessage[]>
  >(() =>
    Object.fromEntries(
      guestDirectConversations.map((conversation) => [
        conversation.id,
        sortMessages(
          conversation.messages.map((message) => ({
            ...message,
            deliveryStatus: message.deliveryStatus ?? "sent",
          })),
        ),
      ]),
    ),
  );
  const [unreadByConversation, setUnreadByConversation] = useState(() =>
    Object.fromEntries(
      guestDirectConversations.map((conversation) => [
        conversation.id,
        conversation.id === conversationId ? 0 : conversation.unreadCount,
      ]),
    ),
  );
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [typingConversationId, setTypingConversationId] = useState<
    string | null
  >(null);
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);
  const injectedConversationIdsRef = useRef(new Set<string>());
  const normalizedSearch = conversationSearch.trim().toLocaleLowerCase("tr-TR");
  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (!normalizedSearch) return true;
        return [
          conversation.member.displayName,
          conversation.member.username,
          conversation.lastMessage?.preview ?? "",
        ].some((value) =>
          value.toLocaleLowerCase("tr-TR").includes(normalizedSearch),
        );
      }),
    [conversations, normalizedSearch],
  );
  const selectedConversation =
    conversations.find(
      (conversation) => conversation.id === conversationId,
    ) ?? null;
  const displayedConversation =
    selectedConversation ?? visibleConversations[0] ?? null;
  const displayedMessages = useMemo(
    () =>
      displayedConversation
        ? messagesByConversation[displayedConversation.id] ?? []
        : [],
    [displayedConversation, messagesByConversation],
  );
  const menuMessage = displayedMessages.find(
    (message) => message.id === menuMessageId,
  );

  const openConversation = (conversation: GuestDirectConversation) => {
    shouldScrollToBottomRef.current = true;
    setNewMessageCount(0);
    setConversationSearch("");
    setUnreadByConversation((current) => ({
      ...current,
      [conversation.id]: 0,
    }));
    setIsListOpen(false);
    onOpen(conversation);
  };

  useLayoutEffect(() => {
    if (!displayedConversation || !shouldScrollToBottomRef.current) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "auto" });
    }
    shouldScrollToBottomRef.current = false;
  }, [conversationId, displayedConversation, displayedMessages, isListOpen]);

  useEffect(() => {
    if (
      !conversationId ||
      !displayedConversation ||
      injectedConversationIdsRef.current.has(displayedConversation.id)
    ) {
      return;
    }

    const activeConversation = displayedConversation;
    injectedConversationIdsRef.current.add(activeConversation.id);
    setTypingConversationId(null);
    const typingTimer = window.setTimeout(() => {
      setTypingConversationId(activeConversation.id);
    }, 800);
    const timer = window.setTimeout(() => {
      setTypingConversationId(null);
      const scroller = scrollerRef.current;
      const shouldStickToBottom =
        !scroller ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
          SCROLL_BOTTOM_THRESHOLD_PX;
      shouldScrollToBottomRef.current = shouldStickToBottom;

      const incomingMessage: ThreadMessage = {
        id: `${activeConversation.id}-live-preview`,
        conversationId: activeConversation.id,
        body:
          activeConversation.id === "guest-conversation-ece"
            ? "Sunum dosyasını da güncelledim."
            : "Tamamdır, görüşürüz.",
        isMine: false,
        isDeleted: false,
        isSeen: false,
        deliveryStatus: "sent",
        createdAt: new Date().toISOString(),
      };

      setMessagesByConversation((current) => ({
        ...current,
        [activeConversation.id]: mergeMessages(
          current[activeConversation.id] ?? [],
          [incomingMessage],
        ),
      }));
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversation.id
            ? {
                ...conversation,
                lastMessage: {
                  id: incomingMessage.id,
                  preview: incomingMessage.body,
                  isMine: false,
                  createdAt: incomingMessage.createdAt,
                },
              }
            : conversation,
        ),
      );
      if (!shouldStickToBottom) {
        setNewMessageCount((current) => current + 1);
        setUnreadByConversation((current) => ({
          ...current,
          [activeConversation.id]:
            (current[activeConversation.id] ?? 0) + 1,
        }));
      }
    }, 5_000);

    return () => {
      window.clearTimeout(typingTimer);
      window.clearTimeout(timer);
    };
  }, [conversationId, displayedConversation]);

  useLayoutEffect(() => {
    if (typingConversationId !== displayedConversation?.id) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const isAtBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      SCROLL_BOTTOM_THRESHOLD_PX;
    if (!isAtBottom) return;

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedConversation?.id, typingConversationId]);

  useEffect(() => {
    if (!menuMessageId) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuMessageId(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuMessageId]);

  const handleThreadScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const isAtBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      SCROLL_BOTTOM_THRESHOLD_PX;
    shouldScrollToBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setNewMessageCount(0);
      if (displayedConversation) {
        setUnreadByConversation((current) => ({
          ...current,
          [displayedConversation.id]: 0,
        }));
      }
    }
  };

  const scrollToLatestMessage = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setNewMessageCount(0);
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  };

  return (
    <section
      aria-label="Mesajlar"
      className="campus-messages-page h-[calc(100svh-9.5rem-env(safe-area-inset-bottom))] min-w-0 overflow-hidden bg-canvas text-white md:h-svh"
    >
      <div className="grid h-full min-h-0 md:grid-cols-[minmax(12rem,0.38fr)_minmax(0,0.62fr)]">
        <aside
          aria-label="Konuşmalar"
          className={`${isListOpen ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col border-r border-white/10`}
        >
          <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <h1 className="text-xl font-black tracking-[-0.045em]">Mesajlar</h1>
            <span className="rounded-full border border-brand/20 bg-brand/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-brand">
              Önizleme
            </span>
          </header>

          <div className="border-b border-white/10 px-3 py-2.5">
            <label className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 transition-colors focus-within:border-brand/38 focus-within:bg-white/[0.05]">
              <SearchIcon />
              <span className="sr-only">Konuşmalarda ara</span>
              <input
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Konuşmalarda ara"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
              {conversationSearch && (
                <button
                  type="button"
                  aria-label="Konuşma aramasını temizle"
                  onClick={() => setConversationSearch("")}
                  className={`grid size-7 place-items-center rounded-full text-white/42 hover:bg-white/8 hover:text-white ${campusFocusRing}`}
                >
                  <CloseIcon />
                </button>
              )}
            </label>
          </div>

          <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {visibleConversations.map((conversation) => {
              const unreadCount = unreadByConversation[conversation.id] ?? 0;

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className={`flex min-h-[4.65rem] w-full min-w-0 items-center gap-3 border-b border-white/8 px-4 py-3 text-left outline-none transition-colors hover:bg-white/[0.045] focus-visible:bg-white/[0.06] ${
                      conversation.id === conversationId
                        ? "bg-white/[0.055]"
                        : ""
                    }`}
                  >
                    <CampusAuthorAvatar
                      author={conversation.member.displayName}
                      authorId={conversation.member.id}
                      avatarUrl={conversation.member.avatarUrl}
                      size="lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-black tracking-[-0.02em]">
                          {conversation.member.displayName}
                        </span>
                        {conversation.lastMessage && (
                          <time className="ml-auto shrink-0 text-[11px] font-semibold text-white/38">
                            {formatConversationTime(
                              conversation.lastMessage.createdAt,
                            )}
                          </time>
                        )}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-2">
                        <span
                          className={`truncate text-xs leading-5 ${
                            unreadCount > 0
                              ? "font-bold text-white/82"
                              : "text-white/43"
                          }`}
                        >
                          {conversation.lastMessage?.preview}
                        </span>
                        {unreadCount > 0 && (
                          <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black text-[#101012]">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {visibleConversations.length === 0 && (
              <li className="px-5 py-10 text-center text-sm font-semibold text-white/42">
                Eşleşen konuşma bulunamadı.
              </li>
            )}
          </ol>

          <footer className="shrink-0 border-t border-white/10 bg-canvas p-3 md:hidden">
            <Link
              href="/giris"
              className={`flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-4 text-center text-xs font-black text-white/78 transition-colors hover:border-brand/30 hover:bg-brand/8 hover:text-brand ${campusFocusRing}`}
            >
              Cevap vermek için giriş yap
            </Link>
          </footer>
        </aside>

        <div
          className={`${isListOpen ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col`}
        >
          {displayedConversation ? (
            <>
              <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-4">
                <button
                  type="button"
                  aria-label="Konuşmalara dön"
                  onClick={() => {
                    setIsListOpen(true);
                    onBack();
                  }}
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-white/68 hover:bg-white/8 md:hidden ${campusFocusRing}`}
                >
                  <BackIcon />
                </button>
                <Link
                  href={`/profil/${encodeURIComponent(displayedConversation.member.username)}`}
                  className={`flex min-w-0 items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5 ${campusFocusRing}`}
                >
                  <CampusAuthorAvatar
                    author={displayedConversation.member.displayName}
                    authorId={displayedConversation.member.id}
                    avatarUrl={displayedConversation.member.avatarUrl}
                    size="md"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-black tracking-[-0.025em]">
                      {displayedConversation.member.displayName}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-white/42">
                      @{displayedConversation.member.username}
                    </span>
                  </span>
                </Link>
                <ConversationHeaderMenu
                  displayName={displayedConversation.member.displayName}
                  username={displayedConversation.member.username}
                  isGuest
                />
              </header>

              <div
                ref={scrollerRef}
                onScroll={handleThreadScroll}
                aria-label="Mesaj geçmişi"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
              >
                <ol className="flex min-h-full flex-col justify-end">
                  {displayedMessages.map((message, index) => {
                    const previousMessage = displayedMessages[index - 1];
                    const nextMessage = displayedMessages[index + 1];
                    const groupedWithPrevious = belongsToMessageGroup(
                      message,
                      previousMessage,
                    );
                    const groupedWithNext = belongsToMessageGroup(
                      message,
                      nextMessage,
                    );
                    const showDaySeparator =
                      !previousMessage ||
                      messageDayKey(previousMessage.createdAt) !==
                        messageDayKey(message.createdAt);
                    const isLastMessage = index === displayedMessages.length - 1;
                    const showMeta =
                      !groupedWithNext || message.deliveryStatus !== "sent";

                    return (
                      <Fragment key={message.id}>
                        {showDaySeparator && (
                          <li
                            role="separator"
                            aria-label={formatMessageDay(message.createdAt)}
                            className="my-4 flex items-center gap-3"
                          >
                            <span className="h-px flex-1 bg-white/8" />
                            <time className="text-[10px] font-black uppercase tracking-[0.09em] text-white/32">
                              {formatMessageDay(message.createdAt)}
                            </time>
                            <span className="h-px flex-1 bg-white/8" />
                          </li>
                        )}
                        <li
                          className={`group flex ${
                            groupedWithPrevious ? "mt-0.5" : "mt-2"
                          } ${message.isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div className="flex max-w-[88%] items-end gap-1 sm:max-w-[76%]">
                            <div
                              className={`rounded-[1.15rem] px-3.5 py-2.5 ${
                                message.isMine
                                  ? `rounded-br-[0.38rem] bg-brand text-[#15110f] ${
                                      groupedWithPrevious
                                        ? "rounded-tr-[0.38rem]"
                                        : ""
                                    }`
                                  : `rounded-bl-[0.38rem] bg-surface-raised text-white ${
                                      groupedWithPrevious
                                        ? "rounded-tl-[0.38rem]"
                                        : ""
                                    }`
                              } ${
                                message.deliveryStatus === "sending"
                                  ? "opacity-72"
                                  : ""
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.42] font-medium">
                                {message.body}
                              </p>
                              {showMeta && (
                                <span
                                  className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] font-bold ${
                                    message.isMine
                                      ? "text-black/48"
                                      : "text-white/32"
                                  }`}
                                >
                                  <time>
                                    {compactDateFormatter.format(
                                      new Date(message.createdAt),
                                    )}
                                  </time>
                                  {message.deliveryStatus === "sending" && (
                                    <span>Gönderiliyor…</span>
                                  )}
                                  {message.deliveryStatus === "failed" && (
                                    <Link
                                      href="/giris"
                                      className="font-black text-[#8c1d10] underline decoration-current/35 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                                    >
                                      Gönderilemedi · Tekrar dene
                                    </Link>
                                  )}
                                  {isLastMessage &&
                                    message.isMine &&
                                    message.isSeen &&
                                    message.deliveryStatus === "sent" && (
                                      <span>Görüldü</span>
                                    )}
                                </span>
                              )}
                            </div>
                            {message.deliveryStatus === "sent" && (
                              <button
                                type="button"
                                aria-label="Mesaj menüsünü aç"
                                aria-haspopup="menu"
                                onClick={() => setMenuMessageId(message.id)}
                                className={`mb-1 grid size-8 shrink-0 place-items-center rounded-full text-white/38 hover:bg-white/8 hover:text-white md:hidden ${campusFocusRing}`}
                              >
                                <MoreIcon />
                              </button>
                            )}
                            {!message.isMine &&
                              message.deliveryStatus === "sent" && (
                                <Link
                                  href="/giris"
                                  aria-label="Mesajı bildirmek için giriş yap"
                                  className="mb-1 hidden size-8 shrink-0 place-items-center rounded-full text-white/0 outline-none transition-colors hover:!bg-white/8 hover:!text-danger focus-visible:text-white/45 focus-visible:ring-2 focus-visible:ring-brand/40 md:grid md:group-hover:text-white/36"
                                >
                                  <FlagIcon />
                                </Link>
                              )}
                          </div>
                        </li>
                      </Fragment>
                    );
                  })}
                </ol>
                {typingConversationId === displayedConversation.id && (
                  <TypingIndicator
                    displayName={displayedConversation.member.displayName}
                    memberId={displayedConversation.member.id}
                    avatarUrl={displayedConversation.member.avatarUrl}
                  />
                )}
                {newMessageCount > 0 && (
                  <div className="pointer-events-none sticky bottom-1 z-10 mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={scrollToLatestMessage}
                      className={`pointer-events-auto rounded-full border border-brand/28 bg-[#171515]/96 px-4 py-2 text-xs font-black text-brand shadow-lg shadow-black/25 backdrop-blur-sm hover:bg-[#201a18] ${campusFocusRing}`}
                    >
                      Yeni mesajlar ↓
                    </button>
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-white/10 bg-canvas p-3">
                <div
                  role="note"
                  className="flex min-h-12 items-center gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.035] px-3.5"
                >
                  <LockIcon />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-xs font-black text-white/72">
                      Cevap vermek için giriş yap
                    </span>
                  </span>
                  <Link
                    href="/giris"
                    className={`shrink-0 rounded-full px-2.5 py-2 text-[11px] font-black text-brand hover:bg-brand/8 ${campusFocusRing}`}
                  >
                    Giriş yap
                  </Link>
                </div>
              </footer>
            </>
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <div className="max-w-xs">
                <MessageIcon className="mx-auto size-12 text-white/22" />
                <h2 className="mt-5 text-2xl font-black tracking-[-0.04em]">
                  Bir konuşma seç
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/48">
                  Örnek mesajları yalnızca görüntüleyebilirsin.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {menuMessage && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Mesaj menüsünü kapat"
            onClick={() => setMenuMessageId(null)}
            className="absolute inset-0 bg-black/58 backdrop-blur-[2px]"
          />
          <section
            role="menu"
            aria-label="Mesaj seçenekleri"
            className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] overflow-hidden rounded-[1.4rem] border border-white/12 bg-surface-raised p-2 shadow-2xl"
          >
            <p className="truncate px-3 pb-2 pt-1 text-xs font-semibold text-white/38">
              {menuMessage.body}
            </p>
            <Link
              href="/giris"
              role="menuitem"
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-black text-brand hover:bg-brand/8 ${campusFocusRing}`}
            >
              {menuMessage.isMine ? <TrashIcon /> : <FlagIcon />}
              {menuMessage.isMine
                ? "Silmek için giriş yap"
                : "Bildirmek için giriş yap"}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => setMenuMessageId(null)}
              className={`mt-1 min-h-12 w-full rounded-xl px-3 text-sm font-black text-white/60 hover:bg-white/6 hover:text-white ${campusFocusRing}`}
            >
              Vazgeç
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

function NewConversationPicker({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (conversation: DirectConversationDto) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowMemberDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [status, setStatus] = useActionStatus();
  const trimmedQuery = query.trim();

  useEffect(() => {
    let cancelled = false;
    if (trimmedQuery.length < 2) {
      queueMicrotask(() => {
        if (!cancelled) {
          setResults([]);
          setIsSearching(false);
        }
      });
      return () => { cancelled = true; };
    }

    queueMicrotask(() => {
      if (!cancelled) setIsSearching(true);
    });
    const timer = window.setTimeout(() => {
      searchMembers(trimmedQuery)
        .then((members) => {
          if (!cancelled) setResults(members);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setStatus({ tone: "error", message: "Kişiler aranamadı." });
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [setStatus, trimmedQuery]);

  const start = async (member: FollowMemberDto) => {
    if (isStarting) return;
    setIsStarting(member.id);
    try {
      onStarted(await startDirectConversation(member.username));
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Konuşma başlatılamadı.",
      });
    } finally {
      setIsStarting(null);
    }
  };

  return (
    <div className="border-b border-white/10 bg-surface-raised/45 p-3">
      <div className="flex items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-full border border-white/12 bg-canvas px-3 focus-within:border-brand/45">
          <SearchIcon />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kişilerde ara"
            aria-label="Mesaj gönderecek kişi ara"
            className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-white/38"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`grid size-10 place-items-center rounded-full text-white/52 hover:bg-white/8 hover:text-white ${campusFocusRing}`}
          aria-label="Kişi aramasını kapat"
        >
          <CloseIcon />
        </button>
      </div>

      <p
        role="note"
        className="mt-2 px-3 text-[11px] font-semibold leading-4 text-white/42"
      >
        Karşılıklı takipte sohbet doğrudan açılır. Diğer kişilerde ilk mesaj
        istek olarak gider.
      </p>

      {status && <ActionStatusText status={status} className="mt-2" />}
      {trimmedQuery.length >= 2 && (
        <div className="mt-2 max-h-60 overflow-y-auto">
          {isSearching ? (
            <p className="px-3 py-4 text-xs font-semibold text-white/48">
              Kişiler aranıyor…
            </p>
          ) : results.length > 0 ? (
            <ul>
              {results.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={isStarting !== null}
                    onClick={() => void start(member)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-white/6 focus-visible:bg-white/6 disabled:opacity-55"
                  >
                    <CampusAuthorAvatar
                      author={member.displayName}
                      authorId={member.id}
                      avatarUrl={member.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {member.displayName}
                      </span>
                      <span className="block truncate text-xs text-white/45">
                        @{member.username}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-xs font-semibold text-white/48">
              Eşleşen kişi bulunamadı.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationHeaderMenu({
  displayName,
  username,
  isGuest = false,
  canReport = true,
  isBusy = false,
  onReport,
  onBlock,
}: {
  displayName: string;
  username: string;
  isGuest?: boolean;
  canReport?: boolean;
  isBusy?: boolean;
  onReport?: () => void;
  onBlock?: () => void;
}) {
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const profileHref = `/profil/${encodeURIComponent(username)}`;

  const closeMenu = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    });
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeMenu, isOpen]);

  const menuItemClass = `flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-black text-white/76 transition-colors hover:bg-white/7 hover:text-white ${campusFocusRing}`;
  const dangerItemClass = `flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-black text-danger transition-colors hover:bg-danger/9 disabled:cursor-not-allowed disabled:opacity-35 ${campusFocusRing}`;

  return (
    <div className="relative ml-auto shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${displayName} için konuşma seçenekleri`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className={`grid size-10 place-items-center rounded-full text-white/52 transition-colors hover:bg-white/8 hover:text-white ${campusFocusRing}`}
      >
        <MoreIcon />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Konuşma seçeneklerini kapat"
            onClick={() => closeMenu()}
            className="fixed inset-0 z-[64] cursor-default bg-black/58 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
          />
          <section
            ref={menuRef}
            role="menu"
            aria-labelledby={headingId}
            className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[65] overflow-hidden rounded-[1.4rem] border border-white/12 bg-surface-raised p-2 shadow-[0_24px_70px_rgba(0,0,0,0.48)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+0.5rem)] md:w-64 md:rounded-2xl"
          >
            <div className="px-3 pb-2 pt-1 md:pb-1">
              <p
                id={headingId}
                className="truncate text-sm font-black tracking-[-0.02em] text-white"
              >
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-white/38">
                @{username}
              </p>
            </div>

            <Link
              role="menuitem"
              href={profileHref}
              onClick={() => closeMenu(false)}
              className={menuItemClass}
            >
              <ProfileIcon />
              Profili gör
            </Link>

            {isGuest ? (
              <>
                <Link
                  role="menuitem"
                  href="/giris"
                  onClick={() => closeMenu(false)}
                  className={menuItemClass}
                >
                  <FlagIcon />
                  Kullanıcıyı bildir
                </Link>
                <Link
                  role="menuitem"
                  href="/giris"
                  onClick={() => closeMenu(false)}
                  className={dangerItemClass}
                >
                  <BlockIcon />
                  Kullanıcıyı engelle
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canReport || isBusy}
                  title={
                    canReport
                      ? undefined
                      : "Bildirilebilecek bir mesaj bulunamadı."
                  }
                  onClick={() => {
                    closeMenu(false);
                    onReport?.();
                  }}
                  className={menuItemClass}
                >
                  <FlagIcon />
                  Kullanıcıyı bildir
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isBusy}
                  onClick={() => {
                    closeMenu(false);
                    onBlock?.();
                  }}
                  className={dangerItemClass}
                >
                  <BlockIcon />
                  {isBusy ? "İşleniyor…" : "Kullanıcıyı engelle"}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => closeMenu()}
              className={`mt-1 min-h-12 w-full rounded-xl px-3 text-sm font-black text-white/48 transition-colors hover:bg-white/6 hover:text-white md:hidden ${campusFocusRing}`}
            >
              Vazgeç
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function MessageThread({
  conversation,
  onBack,
  onConversationChanged,
  onRequestRemoved,
  refreshConversations,
  refreshUnreadCount,
}: {
  conversation: DirectConversationDto;
  onBack: () => void;
  onConversationChanged: (conversation: DirectConversationDto) => void;
  onRequestRemoved: (conversationId: string) => void;
  refreshConversations: (silent?: boolean) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}) {
  const { confirm } = useFeedback();
  const { blockUser } = useCampusModeration();
  const {
    status: realtimeStatus,
    subscribeToConversation,
    sendTyping,
  } = useCampusRealtime();
  const isRealtimeConnected = realtimeStatus === "connected";
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [requestAction, setRequestAction] = useState<
    "accept" | "delete" | "block" | null
  >(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(
    null,
  );
  const [isReportingMember, setIsReportingMember] = useState(false);
  const [headerAction, setHeaderAction] = useState<"block" | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [status, setStatus] = useActionStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);
  const scrollBehaviorRef = useRef<ScrollBehavior>("auto");
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef<ThreadMessage[]>([]);
  const lastMarkedReadMessageIdRef = useRef<string | null>(null);
  const localTypingRef = useRef(false);
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef<number | null>(null);
  const remoteTypingExpiryTimerRef = useRef<number | null>(null);
  useAutoGrowTextarea(textareaRef, body);

  const markLatestMessageRead = useCallback(async () => {
    const latestMessage = messagesRef.current.at(-1);
    if (
      !latestMessage ||
      latestMessage.deliveryStatus !== "sent" ||
      lastMarkedReadMessageIdRef.current === latestMessage.id
    ) {
      return;
    }

    try {
      await markDirectConversationRead(conversation.id, latestMessage.id);
      lastMarkedReadMessageIdRef.current = latestMessage.id;
      await refreshUnreadCount();
    } catch {
      // Polling or the next scroll-to-bottom pass retries the read cursor.
    }
  }, [conversation.id, refreshUnreadCount]);

  const loadLatest = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await listDirectMessages(conversation.id);
      const latestMessages = sortMessages(toThreadMessages(result.data));
      const knownMessageIds = new Set(
        messagesRef.current.map((message) => message.id),
      );
      const addedMessages = latestMessages.filter(
        (message) => !knownMessageIds.has(message.id),
      );
      const scroller = scrollerRef.current;
      const shouldStickToBottom =
        !silent ||
        !scroller ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
          SCROLL_BOTTOM_THRESHOLD_PX;
      isAtBottomRef.current = shouldStickToBottom;
      setMessages((current) => {
        const localPendingMessages = current.filter(
          (message) => message.deliveryStatus !== "sent",
        );
        const next = silent
          ? mergeMessages(current, latestMessages)
          : sortMessages([...latestMessages, ...localPendingMessages]);
        messagesRef.current = next;
        return next;
      });
      if (!silent) setNextCursor(result.page.nextCursor);
      if (addedMessages.length > 0) {
        if (shouldStickToBottom) {
          scrollBehaviorRef.current = "auto";
          shouldScrollToBottomRef.current = true;
        } else {
          setNewMessageCount((current) =>
            current +
            addedMessages.filter((message) => !message.isMine).length,
          );
        }
      }
      if (shouldStickToBottom) await markLatestMessageRead();
      setStatus(null);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Mesajlar yüklenemedi.",
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [conversation.id, markLatestMessageRead, setStatus]);

  useEffect(() => {
    queueMicrotask(() => void loadLatest());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadLatest(true);
    }, isRealtimeConnected
      ? REALTIME_SAFETY_POLL_INTERVAL_MS
      : THREAD_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isRealtimeConnected, loadLatest]);

  useEffect(() =>
    subscribeToConversation(conversation.id, (event) => {
      if (event.type === "conversation.invalidate") {
        void loadLatest(true);
        void refreshConversations(true);
        return;
      }

      if (event.type === "typing") {
        if (remoteTypingExpiryTimerRef.current !== null) {
          window.clearTimeout(remoteTypingExpiryTimerRef.current);
        }
        setIsPeerTyping(event.isTyping);
        remoteTypingExpiryTimerRef.current = event.isTyping
          ? window.setTimeout(() => {
              setIsPeerTyping(false);
              remoteTypingExpiryTimerRef.current = null;
            }, REMOTE_TYPING_EXPIRY_MS)
          : null;
      }
    }),
  [conversation.id, loadLatest, refreshConversations, subscribeToConversation]);

  useEffect(() => () => {
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    if (remoteTypingExpiryTimerRef.current !== null) {
      window.clearTimeout(remoteTypingExpiryTimerRef.current);
    }
    if (localTypingRef.current) sendTyping(conversation.id, false);
  }, [conversation.id, sendTyping]);

  useLayoutEffect(() => {
    if (!isPeerTyping || !isAtBottomRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPeerTyping]);

  useLayoutEffect(() => {
    if (isLoading || !shouldScrollToBottomRef.current) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({
        top: scroller.scrollHeight,
        behavior: scrollBehaviorRef.current,
      });
      isAtBottomRef.current = true;
      setNewMessageCount(0);
      void markLatestMessageRead();
    }
    shouldScrollToBottomRef.current = false;
  }, [isLoading, markLatestMessageRead, messages]);

  const handleThreadScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const isAtBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      SCROLL_BOTTOM_THRESHOLD_PX;
    shouldScrollToBottomRef.current = isAtBottom;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setNewMessageCount(0);
      void markLatestMessageRead();
    }
  };

  const scrollToLatestMessage = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setNewMessageCount(0);
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  };

  const loadOlder = async () => {
    if (!nextCursor || isLoadingOlder) return;
    const scroller = scrollerRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;
    setIsLoadingOlder(true);
    try {
      const result = await listDirectMessages(conversation.id, nextCursor);
      const olderMessages = toThreadMessages(result.data);
      setMessages((current) => {
        const next = mergeMessages(olderMessages, current);
        messagesRef.current = next;
        return next;
      });
      setNextCursor(result.page.nextCursor);
      window.requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop += scroller.scrollHeight - previousHeight;
      });
    } catch {
      setStatus({ tone: "error", message: "Eski mesajlar yüklenemedi." });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const sendPendingMessage = async (pendingMessage: ThreadMessage) => {
    if (isSending) return;

    setIsSending(true);
    setMessages((current) => {
      const next = current.map((message) =>
        message.id === pendingMessage.id
          ? { ...message, deliveryStatus: "sending" as const }
          : message,
      );
      messagesRef.current = next;
      return next;
    });
    try {
      const message = await sendDirectMessage(
        conversation.id,
        pendingMessage.body,
        pendingMessage.clientMessageId!,
      );
      const sentMessage: ThreadMessage = {
        ...message,
        deliveryStatus: "sent",
      };
      setMessages((current) => {
        const hasPendingMessage = current.some(
          (item) => item.id === pendingMessage.id,
        );
        const next = hasPendingMessage
          ? sortMessages(
              current.map((item) =>
                item.id === pendingMessage.id ? sentMessage : item,
              ),
            )
          : mergeMessages(current, [sentMessage]);
        messagesRef.current = next;
        return next;
      });
      shouldScrollToBottomRef.current = true;
      const updatedConversation = await getDirectConversation(conversation.id);
      onConversationChanged(updatedConversation);
      await refreshConversations(true);
      setStatus(null);
    } catch {
      setMessages((current) => {
        const next = current.map((message) =>
          message.id === pendingMessage.id
            ? { ...message, deliveryStatus: "failed" as const }
            : message,
        );
        messagesRef.current = next;
        return next;
      });
      setStatus(null);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const stopLocalTyping = useCallback(() => {
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (localTypingRef.current) {
      sendTyping(conversation.id, false);
      localTypingRef.current = false;
    }
    lastTypingSentAtRef.current = 0;
  }, [conversation.id, sendTyping]);

  const updateBody = useCallback((nextBody: string) => {
    setBody(nextBody);
    if (!nextBody.trim()) {
      stopLocalTyping();
      return;
    }

    const now = Date.now();
    if (
      !localTypingRef.current ||
      now - lastTypingSentAtRef.current >= TYPING_REFRESH_INTERVAL_MS
    ) {
      localTypingRef.current = sendTyping(conversation.id, true);
      if (localTypingRef.current) lastTypingSentAtRef.current = now;
    }
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(
      stopLocalTyping,
      TYPING_IDLE_TIMEOUT_MS,
    );
  }, [conversation.id, sendTyping, stopLocalTyping]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const messageBody = body.trim();
    if (!messageBody || isSending) return;
    stopLocalTyping();
    const clientMessageId = crypto.randomUUID();
    const pendingMessage: ThreadMessage = {
      id: `pending:${clientMessageId}`,
      conversationId: conversation.id,
      body: messageBody,
      isMine: true,
      isDeleted: false,
      isSeen: false,
      createdAt: new Date().toISOString(),
      deliveryStatus: "sending",
      clientMessageId,
    };

    setMessages((current) => {
      const next = sortMessages([...current, pendingMessage]);
      messagesRef.current = next;
      return next;
    });
    setBody("");
    setIsEmojiOpen(false);
    scrollBehaviorRef.current = "auto";
    shouldScrollToBottomRef.current = true;
    await sendPendingMessage(pendingMessage);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const removeMessage = async (message: ThreadMessage) => {
    const confirmed = await confirm({
      title: "Mesaj silinsin mi?",
      description: "Mesajın içeriği iki taraftan da kaldırılacak.",
      confirmLabel: "Mesajı sil",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteDirectMessage(message.id);
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, body: "", isDeleted: true }
            : item,
        ),
      );
      const updatedConversation = await getDirectConversation(conversation.id);
      onConversationChanged(updatedConversation);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Mesaj silinemedi.",
      });
    }
  };

  const handleRequestAction = async (
    action: "accept" | "delete" | "block",
  ) => {
    if (requestAction) return;

    if (action !== "accept") {
      const confirmed = await confirm({
        title:
          action === "block"
            ? `${conversation.member.displayName} engellensin mi?`
            : "Mesaj isteği silinsin mi?",
        description:
          action === "block"
            ? "Konuşma silinir, karşılıklı takip kaldırılır ve bu kişi sana ulaşamaz."
            : "Konuşma silinir ve bu kişi 30 gün boyunca yeni istek gönderemez.",
        confirmLabel: action === "block" ? "Engelle" : "İsteği sil",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setRequestAction(action);
    try {
      const updated = await resolveDirectMessageRequest(
        conversation.id,
        action,
      );

      if (updated) {
        onConversationChanged(updated);
        await refreshConversations(true);
        setStatus({ tone: "success", message: "Mesaj isteği kabul edildi." });
      } else {
        onRequestRemoved(conversation.id);
        await refreshConversations(true);
      }
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Mesaj isteği güncellenemedi.",
      });
    } finally {
      setRequestAction(null);
    }
  };

  const handleBlockMember = async () => {
    if (headerAction) return;

    const confirmed = await confirm({
      title: `${conversation.member.displayName} engellensin mi?`,
      description:
        "Karşılıklı takip kaldırılır, konuşma kapanır ve bu kişi sana yeniden mesaj gönderemez.",
      confirmLabel: "Engelle",
      tone: "danger",
    });
    if (!confirmed) return;

    setHeaderAction("block");
    setStatus(null);
    try {
      const wasBlocked = await blockUser(
        conversation.member.id,
        `@${conversation.member.username}`,
      );

      if (!wasBlocked) {
        setStatus({
          tone: "error",
          message: "Kullanıcı engellenemedi veya zaten engellenmiş.",
        });
        return;
      }

      onRequestRemoved(conversation.id);
      await refreshConversations(true).catch(() => undefined);
      onBack();
    } finally {
      setHeaderAction(null);
    }
  };

  const isIncomingRequest = conversation.requestDirection === "incoming";
  const isWaitingForAcceptance =
    conversation.requestDirection === "outgoing" &&
    conversation.lastMessage !== null;
  const menuMessage = menuMessageId
    ? messages.find((message) => message.id === menuMessageId) ?? null
    : null;
  const reportableMessageId = [...messages]
    .reverse()
    .find(
      (message) =>
        !message.isMine &&
        !message.isDeleted &&
        message.deliveryStatus === "sent",
    )?.id;

  useEffect(() => {
    if (!menuMessageId) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuMessageId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuMessageId]);

  return (
    <>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Konuşmalara dön"
          className={`grid size-10 place-items-center rounded-full text-white/62 hover:bg-white/8 hover:text-white md:hidden ${campusFocusRing}`}
        >
          <BackIcon />
        </button>
        <Link
          href={`/profil/${encodeURIComponent(conversation.member.username)}`}
          className={`flex min-w-0 items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5 ${campusFocusRing}`}
        >
          <CampusAuthorAvatar
            author={conversation.member.displayName}
            authorId={conversation.member.id}
            avatarUrl={conversation.member.avatarUrl}
            size="md"
          />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-black tracking-[-0.025em]">
              {conversation.member.displayName}
            </span>
            <span className="block truncate text-[11px] font-semibold text-white/42">
              @{conversation.member.username}
            </span>
          </span>
        </Link>
        <ConversationHeaderMenu
          displayName={conversation.member.displayName}
          username={conversation.member.username}
          canReport={Boolean(reportableMessageId)}
          isBusy={headerAction !== null}
          onReport={() => {
            if (reportableMessageId) {
              setIsReportingMember(true);
              setReportingMessageId(reportableMessageId);
            }
          }}
          onBlock={() => void handleBlockMember()}
        />
      </header>

      <div
        ref={scrollerRef}
        onScroll={handleThreadScroll}
        aria-label="Mesaj geçmişi"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
      >
        {isLoading ? (
          <div className="grid h-full place-items-center">
            <span className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-brand motion-reduce:animate-none" />
          </div>
        ) : (
          <>
            {nextCursor && (
              <div className="mb-4 text-center">
                <button
                  type="button"
                  disabled={isLoadingOlder}
                  onClick={() => void loadOlder()}
                  className="text-xs font-black text-brand outline-none hover:text-brand-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {isLoadingOlder ? "Yükleniyor…" : "Daha eski mesajlar"}
                </button>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="grid h-full min-h-72 place-items-center text-center">
                <div className="max-w-xs">
                  <CampusAuthorAvatar
                    author={conversation.member.displayName}
                    authorId={conversation.member.id}
                    avatarUrl={conversation.member.avatarUrl}
                    size="lg"
                    className="mx-auto"
                  />
                  <p className="mt-4 text-lg font-black">
                    {conversation.member.displayName}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Konuşmayı başlatmak için bir mesaj gönder.
                  </p>
                </div>
              </div>
            ) : (
              <ol className="flex min-h-full flex-col justify-end">
                {messages.map((message, index) => {
                  const previousMessage = messages[index - 1];
                  const nextMessage = messages[index + 1];
                  const groupedWithPrevious = belongsToMessageGroup(
                    message,
                    previousMessage,
                  );
                  const groupedWithNext = belongsToMessageGroup(
                    message,
                    nextMessage,
                  );
                  const showDaySeparator =
                    !previousMessage ||
                    messageDayKey(previousMessage.createdAt) !==
                      messageDayKey(message.createdAt);
                  const isLastMessage = index === messages.length - 1;
                  const showMeta =
                    !groupedWithNext || message.deliveryStatus !== "sent";

                  return (
                    <Fragment key={message.id}>
                      {showDaySeparator && (
                        <li
                          role="separator"
                          aria-label={formatMessageDay(message.createdAt)}
                          className="my-4 flex items-center gap-3"
                        >
                          <span className="h-px flex-1 bg-white/8" />
                          <time className="text-[10px] font-black uppercase tracking-[0.09em] text-white/32">
                            {formatMessageDay(message.createdAt)}
                          </time>
                          <span className="h-px flex-1 bg-white/8" />
                        </li>
                      )}
                      <li
                        className={`group flex ${
                          groupedWithPrevious ? "mt-0.5" : "mt-2"
                        } ${message.isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div className="flex max-w-[88%] items-end gap-1 sm:max-w-[76%]">
                          {message.isMine &&
                            !message.isDeleted &&
                            message.deliveryStatus === "sent" && (
                              <button
                                type="button"
                                onClick={() => void removeMessage(message)}
                                aria-label="Mesajı sil"
                                className="mb-1 hidden size-8 shrink-0 place-items-center rounded-full text-white/0 outline-none transition-colors hover:!bg-white/8 hover:!text-danger focus-visible:text-white/45 focus-visible:ring-2 focus-visible:ring-brand/40 md:grid md:group-hover:text-white/36"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          <div
                            className={`rounded-[1.15rem] px-3.5 py-2.5 transition-opacity ${
                              message.isDeleted
                                ? "border border-white/10 bg-transparent text-white/38"
                                : message.isMine
                                  ? `rounded-br-[0.38rem] bg-brand text-[#15110f] ${
                                      groupedWithPrevious
                                        ? "rounded-tr-[0.38rem]"
                                        : ""
                                    }`
                                  : `rounded-bl-[0.38rem] bg-surface-raised text-white ${
                                      groupedWithPrevious
                                        ? "rounded-tl-[0.38rem]"
                                        : ""
                                    }`
                            } ${
                              message.deliveryStatus === "sending"
                                ? "opacity-72"
                                : ""
                            }`}
                          >
                            <p
                              className={`whitespace-pre-wrap break-words text-[14px] leading-[1.42] ${
                                message.isDeleted ? "italic" : "font-medium"
                              }`}
                            >
                              {message.isDeleted
                                ? "Bu mesaj silindi."
                                : message.body}
                            </p>
                            {showMeta && (
                              <span
                                className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] font-bold ${
                                  message.isMine && !message.isDeleted
                                    ? "text-black/48"
                                    : "text-white/32"
                                }`}
                              >
                                <time>
                                  {compactDateFormatter.format(
                                    new Date(message.createdAt),
                                  )}
                                </time>
                                {message.deliveryStatus === "sending" && (
                                  <span>Gönderiliyor…</span>
                                )}
                                {message.deliveryStatus === "failed" && (
                                  <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() =>
                                      void sendPendingMessage(message)
                                    }
                                    className="font-black text-[#8c1d10] underline decoration-current/35 underline-offset-2 outline-none disabled:cursor-wait disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-black/25"
                                  >
                                    Gönderilemedi · Tekrar dene
                                  </button>
                                )}
                                {isLastMessage &&
                                  message.isMine &&
                                  message.isSeen &&
                                  message.deliveryStatus === "sent" && (
                                    <span>Görüldü</span>
                                  )}
                              </span>
                            )}
                          </div>
                          {!message.isDeleted &&
                            message.deliveryStatus === "sent" && (
                              <button
                                type="button"
                                aria-label="Mesaj menüsünü aç"
                                aria-haspopup="menu"
                                onClick={() => setMenuMessageId(message.id)}
                                className={`mb-1 grid size-8 shrink-0 place-items-center rounded-full text-white/38 hover:bg-white/8 hover:text-white md:hidden ${campusFocusRing}`}
                              >
                                <MoreIcon />
                              </button>
                            )}
                          {!message.isMine && !message.isDeleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsReportingMember(false);
                                setReportingMessageId(message.id);
                              }}
                              aria-label="Mesajı bildir"
                              className="mb-1 hidden size-8 shrink-0 place-items-center rounded-full text-white/0 outline-none transition-colors hover:!bg-white/8 hover:!text-danger focus-visible:text-white/45 focus-visible:ring-2 focus-visible:ring-brand/40 md:grid md:group-hover:text-white/36"
                            >
                              <FlagIcon />
                            </button>
                          )}
                        </div>
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
            )}
            {isPeerTyping && (
              <TypingIndicator
                displayName={conversation.member.displayName}
                memberId={conversation.member.id}
                avatarUrl={conversation.member.avatarUrl}
              />
            )}
            {newMessageCount > 0 && (
              <div className="pointer-events-none sticky bottom-1 z-10 mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={scrollToLatestMessage}
                  className={`pointer-events-auto rounded-full border border-brand/28 bg-[#171515]/96 px-4 py-2 text-xs font-black text-brand shadow-lg shadow-black/25 backdrop-blur-sm hover:bg-[#201a18] ${campusFocusRing}`}
                >
                  Yeni mesajlar ↓
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-canvas p-2.5 sm:p-3">
        {status && <ActionStatusText status={status} className="mb-2" />}
        {conversation.requestDirection === "outgoing" &&
          conversation.lastMessage === null && (
            <p
              role="note"
              className="mb-2 text-center text-[11px] font-semibold leading-4 text-white/45"
            >
              Henüz karşılıklı takipte değilsiniz. İlk mesajın istek olarak
              gider.
            </p>
          )}
        {isIncomingRequest ? (
          <div>
            <p className="mb-2.5 text-center text-xs font-semibold leading-5 text-white/48">
              Yanıtlamak için mesaj isteğini kabul et.
            </p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <button
                type="button"
                disabled={requestAction !== null}
                onClick={() => void handleRequestAction("accept")}
                className={`${campusButton.primary} min-h-11 !px-3`}
              >
                {requestAction === "accept" ? "Kabul ediliyor…" : "Kabul et"}
              </button>
              <button
                type="button"
                disabled={requestAction !== null}
                onClick={() => void handleRequestAction("delete")}
                className={`${campusButton.secondary} min-h-11 !px-3`}
              >
                Sil
              </button>
              <button
                type="button"
                disabled={requestAction !== null}
                onClick={() => void handleRequestAction("block")}
                className={`min-h-11 rounded-full px-3 text-xs font-black text-danger transition-colors hover:bg-danger/10 disabled:opacity-45 ${campusFocusRing}`}
              >
                Engelle
              </button>
            </div>
          </div>
        ) : isWaitingForAcceptance ? (
          <div className="flex min-h-12 items-center justify-center rounded-[1.15rem] border border-white/10 bg-white/[0.035] px-4 text-center">
            <p className="text-xs font-bold text-white/55">
              Mesaj isteği gönderildi. Kabul edilince yazmaya devam edebilirsin.
            </p>
          </div>
        ) : (
        <form onSubmit={(event) => void submit(event)} className="flex items-end gap-2">
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Emoji ekle"
              aria-expanded={isEmojiOpen}
              onClick={() => setIsEmojiOpen((open) => !open)}
              className={`grid size-11 place-items-center rounded-full text-brand transition-colors hover:bg-brand/8 ${campusFocusRing}`}
            >
              <SmileIcon />
            </button>
            {isEmojiOpen && (
              <CampusEmojiPicker
                onSelect={(emoji) => {
                  updateBody(`${body}${emoji}`.slice(0, 1000));
                  textareaRef.current?.focus();
                }}
              />
            )}
          </div>
          <label htmlFor="direct-message-body" className="sr-only">
            Mesaj
          </label>
          <textarea
            ref={textareaRef}
            id="direct-message-body"
            value={body}
            maxLength={1000}
            rows={1}
            onChange={(event) => updateBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yaz"
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-[1.2rem] border border-white/12 bg-white/[0.045] px-4 py-[0.7rem] text-[14px] leading-5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-brand/42 focus:bg-white/[0.06]"
          />
          <button
            type="submit"
            disabled={!body.trim() || isSending}
            aria-label="Mesajı gönder"
            className={`grid size-11 shrink-0 place-items-center rounded-full bg-brand text-[#101012] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-35 ${campusFocusRing}`}
          >
            <SendIcon />
          </button>
        </form>
        )}
      </footer>

      {menuMessage && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Mesaj menüsünü kapat"
            onClick={() => setMenuMessageId(null)}
            className="absolute inset-0 bg-black/58 backdrop-blur-[2px]"
          />
          <section
            role="menu"
            aria-label="Mesaj seçenekleri"
            className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] overflow-hidden rounded-[1.4rem] border border-white/12 bg-surface-raised p-2 shadow-2xl"
          >
            <p className="truncate px-3 pb-2 pt-1 text-xs font-semibold text-white/38">
              {menuMessage.body}
            </p>
            {menuMessage.isMine ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuMessageId(null);
                  void removeMessage(menuMessage);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-black text-danger hover:bg-danger/8 ${campusFocusRing}`}
              >
                <TrashIcon />
                Mesajı sil
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuMessageId(null);
                  setIsReportingMember(false);
                  setReportingMessageId(menuMessage.id);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-black text-danger hover:bg-danger/8 ${campusFocusRing}`}
              >
                <FlagIcon />
                Mesajı bildir
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => setMenuMessageId(null)}
              className={`mt-1 min-h-12 w-full rounded-xl px-3 text-sm font-black text-white/60 hover:bg-white/6 hover:text-white ${campusFocusRing}`}
            >
              Vazgeç
            </button>
          </section>
        </div>
      )}

      {reportingMessageId && (
        <CampusMessageReportDialog
          messageId={reportingMessageId}
          title={isReportingMember ? "Kullanıcıyı bildir" : undefined}
          description={
            isReportingMember
              ? "Konuşmadaki son mesaj inceleme bağlamı olarak moderasyona gönderilir."
              : undefined
          }
          onClose={() => {
            setReportingMessageId(null);
            setIsReportingMember(false);
          }}
          onReported={(created) => {
            setReportingMessageId(null);
            setIsReportingMember(false);
            setStatus({
              tone: "success",
              message: created
                ? "Mesaj moderasyon sırasına eklendi."
                : "Bu mesajı daha önce bildirdin.",
            });
          }}
        />
      )}
    </>
  );
}

function ConversationListSkeleton() {
  return (
    <div role="status" aria-label="Konuşmalar yükleniyor" className="animate-pulse motion-reduce:animate-none">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex min-h-[4.65rem] items-center gap-3 border-b border-white/8 px-4 py-3">
          <span className="size-12 rounded-full bg-white/7" />
          <span className="min-w-0 flex-1">
            <span className="block h-3 w-2/5 rounded-full bg-white/8" />
            <span className="mt-2 block h-2.5 w-4/5 rounded-full bg-white/5" />
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 11.5a7.7 7.7 0 0 1-8 7.5 8.8 8.8 0 0 1-3.1-.55L4 20l1.45-4.1A7.2 7.2 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z" />
    </svg>
  );
}

function ComposeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M13.5 5H6.8A2.8 2.8 0 0 0 4 7.8v9.4A2.8 2.8 0 0 0 6.8 20h9.4a2.8 2.8 0 0 0 2.8-2.8v-6.7"/><path d="m12 12 7.2-7.2a1.4 1.4 0 0 1 2 2L14 14l-3 .8 1-2.8Z"/></svg>;
}
function SearchIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-white/40"><circle cx="8.7" cy="8.7" r="5.4" stroke="currentColor" strokeWidth="1.7"/><path d="m12.8 12.8 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function CloseIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function BackIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5"><path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function LockIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-brand"><rect x="4.2" y="8.3" width="11.6" height="8.2" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M6.8 8.3V6.5a3.2 3.2 0 0 1 6.4 0v1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function SmileIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.2c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8M9 9.5h.01M15 9.5h.01"/></svg>; }
function SendIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="m4 5 16 7-16 7 3-7-3-7Z"/><path d="M7 12h13"/></svg>; }
function TrashIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M4.8 6h10.4M8 3.8h4M7 8.5v5.8m3-5.8v5.8m3-5.8v5.8M6 6l.6 10h6.8L14 6"/></svg>; }
function FlagIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M5 16.5v-13m.5 1h7.8l-1.6 2.8 1.6 2.8H5.5"/></svg>; }
function MoreIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4"><circle cx="4" cy="10" r="1.35"/><circle cx="10" cy="10" r="1.35"/><circle cx="16" cy="10" r="1.35"/></svg>; }
function ProfileIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4"><circle cx="10" cy="6.5" r="3"/><path d="M4.5 16c.55-3 2.4-4.5 5.5-4.5s4.95 1.5 5.5 4.5"/></svg>; }
function BlockIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4"><circle cx="10" cy="10" r="6.5"/><path d="m5.4 5.4 9.2 9.2"/></svg>; }
