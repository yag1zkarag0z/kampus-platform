"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
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
import { useCampusMessaging } from "@/components/CampusMessagingProvider";
import { campusButton, campusFocusRing } from "@/components/campusButtonStyles";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
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
  sendDirectMessage,
  startDirectConversation,
  type DirectConversationDto,
  type DirectMessageDto,
} from "@/messaging/client";
import { searchMembers, type FollowMemberDto } from "@/social/client";

const THREAD_POLL_INTERVAL_MS = 6_000;
const CONVERSATION_POLL_INTERVAL_MS = 15_000;

const compactDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});
const listDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
});

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

function sortMessages(messages: DirectMessageDto[]) {
  return [...messages].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime() ||
      first.id.localeCompare(second.id, "en"),
  );
}

function mergeMessages(
  current: DirectMessageDto[],
  incoming: DirectMessageDto[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return sortMessages([...byId.values()]);
}

function mergeConversation(
  current: DirectConversationDto[],
  incoming: DirectConversationDto,
) {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)];
}

export default function CampusMessages() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionMode, retrySession } = useCampusAccount();
  const { markGuestMessagesRead, refreshUnreadMessageCount } =
    useCampusMessaging();
  const [conversations, setConversations] = useState<DirectConversationDto[]>([]);
  const [isLoading, setIsLoading] = useState(sessionMode === "member");
  const [hasFailed, setHasFailed] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [startStatus, setStartStatus] = useActionStatus();
  const startedUsernameRef = useRef<string | null>(null);
  const conversationId = searchParams.get("sohbet");
  const requestedUsername = searchParams.get("kullanici")?.trim() ?? "";
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) ?? null,
    [conversationId, conversations],
  );

  useEffect(() => {
    if (sessionMode === "guest") {
      markGuestMessagesRead();
    }
  }, [markGuestMessagesRead, sessionMode]);

  const refreshConversations = useCallback(async (silent = false) => {
    if (sessionMode !== "member") return;
    if (!silent) setIsLoading(true);

    try {
      const result = await listDirectConversations();
      setConversations(result);
      setHasFailed(false);
    } catch (error) {
      if (!silent) setHasFailed(true);
      if (error instanceof AuthClientError && error.status === 401) {
        void retrySession();
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [retrySession, sessionMode]);

  useEffect(() => {
    queueMicrotask(() => void refreshConversations());

    if (sessionMode !== "member") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshConversations(true);
      }
    }, CONVERSATION_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [refreshConversations, sessionMode]);

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
        setConversations((current) =>
          mergeConversation(current, conversation),
        );
      })
      .catch(() => {
        router.replace("/mesajlar", { scroll: false });
      });
  }, [conversationId, isLoading, router, selectedConversation, sessionMode]);

  const openConversation = (conversation: DirectConversationDto) => {
    setConversations((current) =>
      current.map((item) =>
        item.id === conversation.id ? { ...item, unreadCount: 0 } : item,
      ),
    );
    router.push(
      `/mesajlar?sohbet=${encodeURIComponent(conversation.id)}`,
      { scroll: false },
    );
  };

  const handleConversationChanged = useCallback(
    (conversation: DirectConversationDto) => {
      setConversations((current) => mergeConversation(current, conversation));
    },
    [],
  );

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
      className="campus-messages-page h-[calc(100svh-4rem)] min-w-0 overflow-hidden bg-canvas text-white md:h-svh"
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
            ) : conversations.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <MessageIcon className="mx-auto size-10 text-white/25" />
                  <p className="mt-4 text-base font-black">Henüz konuşma yok</p>
                  <p className="mt-1 text-sm leading-5 text-white/48">
                    Kampüsten birini bulup ilk mesajı gönder.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="mt-4 text-sm font-black text-brand outline-none hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    Yeni mesaj →
                  </button>
                </div>
              </div>
            ) : (
              <ol>
                {conversations.map((conversation) => (
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
  const [unreadByConversation, setUnreadByConversation] = useState(() =>
    Object.fromEntries(
      guestDirectConversations.map((conversation) => [
        conversation.id,
        conversation.id === conversationId ? 0 : conversation.unreadCount,
      ]),
    ),
  );
  const selectedConversation =
    guestDirectConversations.find(
      (conversation) => conversation.id === conversationId,
    ) ?? null;
  const displayedConversation =
    selectedConversation ?? guestDirectConversations[0];

  const openConversation = (conversation: GuestDirectConversation) => {
    setUnreadByConversation((current) => ({
      ...current,
      [conversation.id]: 0,
    }));
    setIsListOpen(false);
    onOpen(conversation);
  };

  return (
    <section
      aria-label="Mesajlar"
      className="campus-messages-page h-[calc(100svh-4rem)] min-w-0 overflow-hidden bg-canvas text-white md:h-svh"
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

          <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {guestDirectConversations.map((conversation) => {
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
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
                <ol className="flex min-h-full flex-col justify-end gap-1.5">
                  {displayedConversation.messages.map((message) => (
                    <li
                      key={message.id}
                      className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[86%] rounded-[1.15rem] px-3.5 py-2.5 sm:max-w-[78%] ${
                          message.isMine
                            ? "rounded-br-[0.35rem] bg-brand text-[#15110f]"
                            : "rounded-bl-[0.35rem] bg-surface-raised text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.42] font-medium">
                          {message.body}
                        </p>
                        <time
                          className={`mt-1 block text-right text-[9px] font-bold ${
                            message.isMine ? "text-black/48" : "text-white/32"
                          }`}
                        >
                          {compactDateFormatter.format(
                            new Date(message.createdAt),
                          )}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
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

function MessageThread({
  conversation,
  onBack,
  onConversationChanged,
  refreshConversations,
  refreshUnreadCount,
}: {
  conversation: DirectConversationDto;
  onBack: () => void;
  onConversationChanged: (conversation: DirectConversationDto) => void;
  refreshConversations: (silent?: boolean) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}) {
  const { confirm } = useFeedback();
  const [messages, setMessages] = useState<DirectMessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [status, setStatus] = useActionStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);
  useAutoGrowTextarea(textareaRef, body);

  const loadLatest = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await listDirectMessages(conversation.id);
      setMessages((current) =>
        silent
          ? mergeMessages(current, result.data)
          : sortMessages(result.data),
      );
      if (!silent) setNextCursor(result.page.nextCursor);
      await markDirectConversationRead(conversation.id);
      await refreshUnreadCount();
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
  }, [conversation.id, refreshUnreadCount, setStatus]);

  useEffect(() => {
    queueMicrotask(() => void loadLatest());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadLatest(true);
    }, THREAD_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadLatest]);

  useEffect(() => {
    if (isLoading || !shouldScrollToBottomRef.current) return;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    shouldScrollToBottomRef.current = false;
  }, [isLoading, messages]);

  const loadOlder = async () => {
    if (!nextCursor || isLoadingOlder) return;
    const scroller = scrollerRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;
    setIsLoadingOlder(true);
    try {
      const result = await listDirectMessages(conversation.id, nextCursor);
      setMessages((current) => mergeMessages(result.data, current));
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

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const messageBody = body.trim();
    if (!messageBody || isSending) return;
    setIsSending(true);
    try {
      const message = await sendDirectMessage(conversation.id, messageBody);
      setMessages((current) => mergeMessages(current, [message]));
      setBody("");
      setIsEmojiOpen(false);
      shouldScrollToBottomRef.current = true;
      const updatedConversation = await getDirectConversation(conversation.id);
      onConversationChanged(updatedConversation);
      await refreshConversations(true);
      setStatus(null);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Mesaj gönderilemedi.",
      });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const removeMessage = async (message: DirectMessageDto) => {
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
      </header>

      <div
        ref={scrollerRef}
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
              <ol className="flex min-h-full flex-col justify-end gap-1.5">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className={`group flex ${message.isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div className="flex max-w-[86%] items-end gap-1 sm:max-w-[78%]">
                      {message.isMine && !message.isDeleted && (
                        <button
                          type="button"
                          onClick={() => void removeMessage(message)}
                          aria-label="Mesajı sil"
                          className="mb-1 grid size-8 shrink-0 place-items-center rounded-full text-white/0 outline-none transition-colors group-hover:text-white/36 hover:!bg-white/8 hover:!text-danger focus-visible:text-white/45 focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <TrashIcon />
                        </button>
                      )}
                      <div
                        className={`rounded-[1.15rem] px-3.5 py-2.5 ${
                          message.isDeleted
                            ? "border border-white/10 bg-transparent text-white/38"
                            : message.isMine
                              ? "rounded-br-[0.35rem] bg-brand text-[#15110f]"
                              : "rounded-bl-[0.35rem] bg-surface-raised text-white"
                        }`}
                      >
                        <p className={`whitespace-pre-wrap break-words text-[14px] leading-[1.42] ${message.isDeleted ? "italic" : "font-medium"}`}>
                          {message.isDeleted ? "Bu mesaj silindi." : message.body}
                        </p>
                        <time
                          className={`mt-1 block text-right text-[9px] font-bold ${
                            message.isMine && !message.isDeleted
                              ? "text-black/48"
                              : "text-white/32"
                          }`}
                        >
                          {compactDateFormatter.format(new Date(message.createdAt))}
                        </time>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-canvas p-2.5 sm:p-3">
        {status && <ActionStatusText status={status} className="mb-2" />}
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
                  setBody((current) => `${current}${emoji}`.slice(0, 1000));
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
            onChange={(event) => setBody(event.target.value)}
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
      </footer>
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
