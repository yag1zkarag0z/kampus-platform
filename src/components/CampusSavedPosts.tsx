"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { AuthClientError } from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { campusButton } from "@/components/campusButtonStyles";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  appendUniqueCampusPosts,
  getUsablePageCursor,
  toCampusPost,
} from "@/content/adapter";
import {
  listContentBookmarks,
  setContentPostBookmark,
  voteInContentPoll,
} from "@/content/client";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
  type CampusPost,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

export default function CampusSavedPosts() {
  const { sessionMode } = useCampusAccount();

  if (sessionMode === "member") {
    return <MemberSavedPosts />;
  }

  return <LocalSavedPosts />;
}

function insertPostAt(
  posts: CampusPost[],
  post: CampusPost,
  index: number,
) {
  const next = [...posts];

  next.splice(Math.min(Math.max(index, 0), next.length), 0, post);

  return next;
}

function useSavedBookmarks() {
  const { retrySession } = useCampusAccount();
  const [posts, setPostsState] = useState<CampusPost[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const postsRef = useRef(posts);
  const isLoadingMoreRef = useRef(false);

  const replacePosts = useCallback((nextPosts: CampusPost[]) => {
    postsRef.current = nextPosts;
    setPostsState(nextPosts);
  }, []);
  const updatePosts = useCallback(
    (updater: (currentPosts: CampusPost[]) => CampusPost[]) => {
      replacePosts(updater(postsRef.current));
    },
    [replacePosts],
  );
  const handleExpiredSession = useCallback(
    (error: unknown) => {
      if (error instanceof AuthClientError && error.status === 401) {
        void retrySession();
      }
    },
    [retrySession],
  );

  useEffect(() => {
    let isCancelled = false;
    isLoadingMoreRef.current = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsHydrated(false);
        setHasLoadFailed(false);
        setNextCursor(null);
        setIsLoadingMore(false);
      }
    });

    listContentBookmarks()
      .then((response) => {
        if (isCancelled) {
          return;
        }

        replacePosts(response.data.map(toCampusPost));
        setNextCursor(getUsablePageCursor(response.page));
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        replacePosts([]);
        setNextCursor(null);
        setHasLoadFailed(true);
        handleExpiredSession(error);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [handleExpiredSession, reloadToken, replacePosts]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await listContentBookmarks({ cursor: nextCursor });

      updatePosts((currentPosts) =>
        appendUniqueCampusPosts(
          currentPosts,
          response.data.map(toCampusPost),
        ),
      );
      setNextCursor(getUsablePageCursor(response.page));
    } catch (error) {
      handleExpiredSession(error);
      throw error;
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [handleExpiredSession, nextCursor, updatePosts]);

  const removeBookmark = useCallback(
    async (postId: string) => {
      const index = postsRef.current.findIndex(
        (post) => post.id === postId,
      );

      if (index < 0) {
        return null;
      }

      const removedPost = postsRef.current[index]!;

      updatePosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== postId),
      );

      try {
        await setContentPostBookmark(postId, false);

        return { post: removedPost, index };
      } catch (error) {
        updatePosts((currentPosts) =>
          currentPosts.some((post) => post.id === postId)
            ? currentPosts
            : insertPostAt(currentPosts, removedPost, index),
        );
        handleExpiredSession(error);

        throw error;
      }
    },
    [handleExpiredSession, updatePosts],
  );

  const restoreBookmark = useCallback(
    async (post: CampusPost, index: number) => {
      try {
        await setContentPostBookmark(post.id, true);

        updatePosts((currentPosts) =>
          currentPosts.some((currentPost) => currentPost.id === post.id)
            ? currentPosts
            : insertPostAt(currentPosts, post, index),
        );
      } catch (error) {
        handleExpiredSession(error);

        throw error;
      }
    },
    [handleExpiredSession, updatePosts],
  );

  const voteInSavedPoll = useCallback(
    async (postId: string, optionId: string) => {
      try {
        const voted = toCampusPost(
          await voteInContentPoll(postId, optionId),
        );

        updatePosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId && voted.poll
              ? { ...post, poll: voted.poll }
              : post,
          ),
        );
      } catch (error) {
        handleExpiredSession(error);

        throw error;
      }
    },
    [handleExpiredSession, updatePosts],
  );

  return {
    posts,
    isHydrated,
    hasLoadFailed,
    hasMore: nextCursor !== null,
    isLoadingMore,
    loadMore,
    reload,
    removeBookmark,
    restoreBookmark,
    voteInSavedPoll,
  };
}

function MemberSavedPosts() {
  const { showToast } = useFeedback();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const {
    posts,
    isHydrated,
    hasLoadFailed,
    hasMore,
    isLoadingMore,
    loadMore,
    reload,
    removeBookmark,
    restoreBookmark,
    voteInSavedPoll,
  } = useSavedBookmarks();

  const undoRemoval = async (post: CampusPost, index: number) => {
    try {
      await restoreBookmark(post, index);
      showToast({
        message: `“${post.title || "Gönderi"}” yeniden kaydedildi.`,
        tone: "success",
      });
    } catch {
      showToast({
        message: "Kayıt geri alınamadı. Tekrar dene.",
        tone: "error",
      });
    }
  };

  const removeSavedPost = async (post: CampusPost) => {
    try {
      const removal = await removeBookmark(post.id);

      if (!removal) {
        return;
      }

      showToast({
        message: `“${post.title || "Gönderi"}” kaydedilenlerden kaldırıldı.`,
        tone: "info",
        action: {
          label: "Geri al",
          onClick: () => void undoRemoval(removal.post, removal.index),
        },
      });
      requestAnimationFrame(() => titleRef.current?.focus());
    } catch {
      showToast({
        message: "Kayıt kaldırılamadı. Tekrar dene.",
        tone: "error",
      });
    }
  };

  const loadMoreSavedPosts = async () => {
    try {
      await loadMore();
    } catch {
      showToast({
        message: "Kayıtlar yüklenemedi. Tekrar dene.",
        tone: "error",
      });
    }
  };

  return (
    <SavedPostsView
      titleRef={titleRef}
      posts={posts}
      isHydrated={isHydrated}
      hasLoadFailed={hasLoadFailed}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onReload={reload}
      onLoadMore={() => void loadMoreSavedPosts()}
      onRemove={(post) => void removeSavedPost(post)}
      onVote={(postId, optionId) => {
        void voteInSavedPoll(postId, optionId).catch(() => {
          showToast({
            message: "Oyun kaydedilemedi. Tekrar dene.",
            tone: "error",
          });
        });
      }}
    />
  );
}

function LocalSavedPosts() {
  const router = useRouter();
  const { isGuest } = useCampusAccount();
  const { posts, isHydrated, toggleBookmark } = useCampusData();
  const { showToast } = useFeedback();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const savedPosts = useMemo(
    () =>
      posts
        .filter((post) => post.bookmarked && !post.isDeleted)
        .sort(
          (first, second) =>
            second.createdAt - first.createdAt ||
            second.id.localeCompare(first.id, "tr"),
        ),
    [posts],
  );

  const removeSavedPost = (post: CampusPost) => {
    if (isGuest) {
      showToast({
        message: "Kaydedilenleri değiştirmek için giriş yap veya kayıt ol.",
        tone: "info",
        action: {
          label: "Giriş yap",
          onClick: () => router.push("/giris"),
        },
      });
      return;
    }

    toggleBookmark(post.id);
    showToast({
      message: `“${post.title || "Gönderi"}” kaydedilenlerden kaldırıldı.`,
      tone: "info",
      action: {
        label: "Geri al",
        onClick: () => toggleBookmark(post.id),
      },
    });
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  return (
    <SavedPostsView
      titleRef={titleRef}
      posts={savedPosts}
      isHydrated={isHydrated}
      onRemove={removeSavedPost}
    />
  );
}

function SavedPostsView({
  titleRef,
  posts,
  isHydrated,
  hasLoadFailed = false,
  hasMore = false,
  isLoadingMore = false,
  onReload,
  onLoadMore,
  onRemove,
  onVote,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  posts: CampusPost[];
  isHydrated: boolean;
  hasLoadFailed?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onReload?: () => void;
  onLoadMore?: () => void;
  onRemove: (post: CampusPost) => void;
  onVote?: (postId: string, optionId: string) => void;
}) {
  return (
    <section
      aria-labelledby="saved-posts-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#ff7a45]">
              Kişisel alan
            </p>
            <h1
              ref={titleRef}
              id="saved-posts-title"
              tabIndex={-1}
              className="mt-0.5 truncate text-2xl font-black tracking-[-0.04em] outline-none sm:text-3xl"
            >
              Kaydedilenler
            </h1>
          </div>

          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only shrink-0 justify-self-end text-right text-xs font-bold text-white/55 min-[420px]:not-sr-only"
          >
            {isHydrated
              ? `${posts.length}${hasMore ? "+" : ""} kayıt`
              : "Kayıtlar yükleniyor"}
          </p>
        </div>
      </header>

      {!isHydrated ? (
        <SavedPostsLoading />
      ) : hasLoadFailed ? (
        <SavedPostsErrorState onReload={onReload} />
      ) : posts.length > 0 ? (
        <>
          <ol className="grid min-w-0 px-3 py-3 sm:px-5 sm:py-4 lg:px-6 2xl:grid-cols-2 2xl:gap-4">
            {posts.map((post) => (
              <li
                key={post.id}
                className="min-w-0 border-b border-white/9 last:border-b-0 2xl:border 2xl:bg-white/[0.015] 2xl:px-5 2xl:last:border-b"
              >
                <SavedPostCard
                  post={post}
                  onRemove={onRemove}
                  onVote={onVote}
                />
              </li>
            ))}
          </ol>

          {hasMore && (
            <div className="px-4 pb-6 text-center sm:px-6">
              <button
                type="button"
                aria-label="Daha fazla kayıt yükle"
                aria-busy={isLoadingMore}
                disabled={isLoadingMore}
                onClick={onLoadMore}
                className={campusButton.secondary}
              >
                {isLoadingMore
                  ? "Kayıtlar yükleniyor…"
                  : "Daha fazla kayıt yükle"}
              </button>
            </div>
          )}
        </>
      ) : (
        <SavedPostsEmptyState />
      )}
    </section>
  );
}

function SavedPostCard({
  post,
  onRemove,
  onVote,
}: {
  post: CampusPost;
  onRemove: (post: CampusPost) => void;
  onVote?: (postId: string, optionId: string) => void;
}) {
  return (
    <CampusPostCardSurface
      postId={post.id}
      className="flex h-full min-w-0 flex-col py-5 sm:py-6"
    >
      <header className="flex items-start gap-2.5">
        <CampusAuthorProfileLink
          author={post.author}
          authorId={post.authorId}
          isAnonymous={post.isAnonymous}
          ariaLabel={`${post.author} profilini aç`}
          className="shrink-0"
          linkClassName={`rounded-full transition-opacity hover:opacity-80 ${focusRing}`}
        >
          <CampusAuthorAvatar
            author={post.author}
            authorId={post.authorId}
            avatarUrl={post.avatarUrl}
            isAnonymous={post.isAnonymous}
            size="sm"
          />
        </CampusAuthorProfileLink>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
          <span
            className={`${campusCategoryBadgeBase} ${campusCategoryStyles[post.category].badge}`}
          >
            <span aria-hidden="true">
              {campusCategoryStyles[post.category].glyph}
            </span>
            {post.category}
          </span>
          <span
            aria-hidden="true"
            className="size-1 rotate-45 bg-[#ff7a45]/58"
          />
          <CampusAuthorProfileLink
            author={post.author}
            authorId={post.authorId}
            isAnonymous={post.isAnonymous}
            ariaLabel={`${post.author} profilini aç`}
            className="min-w-0"
            linkClassName={`truncate text-xs font-black transition-colors hover:text-[#ff7a45] ${focusRing}`}
          >
            <span className="truncate text-xs font-black">
              {post.author}
            </span>
          </CampusAuthorProfileLink>
          {!isAnonymousCampusAuthor(post) && post.detail && (
            <span className="text-[11px] font-semibold text-white/55">
              {post.detail}
            </span>
          )}
          <span aria-hidden="true" className="text-white/28">
            ·
          </span>
          <time className="text-[11px] font-semibold text-white/55">
            {post.time}
          </time>
        </div>
      </header>

      <h2 className="mt-2.5 max-w-[78ch] break-words text-lg font-black leading-6 tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-xl sm:leading-7">
        <Link
          href={`/gonderi/${post.id}`}
          className={`decoration-[#ff7a45]/30 underline-offset-4 transition-colors hover:text-[#ff7a45] hover:underline ${focusRing}`}
        >
          {post.title}
        </Link>
      </h2>

      {post.listing && (
        <CampusListingMeta listing={post.listing} variant="compact" />
      )}

      <p className="mt-2.5 line-clamp-3 max-w-[78ch] whitespace-pre-wrap break-words text-[15px] leading-7 tracking-[-0.01em] text-white/74 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-7">
        {post.body}
      </p>

      {post.image && (
        <CampusPostImage image={post.image} variant="compact" />
      )}
      {post.gif && <CampusGif gif={post.gif} compact />}
      {post.poll && (
        <CampusPoll
          postId={post.id}
          poll={post.poll}
          compact
          onVote={
            onVote
              ? (optionId) => onVote(post.id, optionId)
              : undefined
          }
        />
      )}

      <footer className="mt-auto flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs font-bold text-white/55">
        <span className="inline-flex min-h-11 items-center gap-1.5">
          <HeartIcon />
          {post.likes} beğeni
        </span>
        <span className="inline-flex min-h-11 items-center gap-1.5">
          <CommentIcon />
          {getCampusPostCommentCount(post)} yorum
        </span>
        <button
          type="button"
          aria-label={`“${post.title}” kaydını kaldır`}
          onClick={() => onRemove(post)}
          className={`ml-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 hover:text-[#ff7a45]/80 ${focusRing}`}
        >
          <BookmarkIcon />
          Kaydı kaldır
        </button>
      </footer>
    </CampusPostCardSurface>
  );
}

function SavedPostsLoading() {
  return (
    <div
      role="status"
      aria-label="Kaydedilen gönderiler yükleniyor"
      className="grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6"
    >
      <div>
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff7a45] motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-bold text-white/60">
          Kaydedilen gönderiler yükleniyor…
        </p>
      </div>
    </div>
  );
}

function SavedPostsErrorState({ onReload }: { onReload?: () => void }) {
  return (
    <div className="grid min-h-[28rem] place-items-center px-4 py-14 text-center sm:px-6">
      <div className="max-w-md">
        <h2 className="text-lg font-black tracking-[-0.03em]">
          Kaydedilenler yüklenemedi
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Bağlantı kurulamadığı için kayıtların şu anda gösterilemiyor.
        </p>
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            className={`mt-6 ${campusButton.primary}`}
          >
            Yeniden dene
          </button>
        )}
      </div>
    </div>
  );
}

function SavedPostsEmptyState() {
  return (
    <div className="grid min-h-[28rem] place-items-center px-4 py-14 text-center sm:px-6">
      <div className="max-w-md">
        <span
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/11 text-[#ff7a45]"
        >
          <BookmarkIcon />
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          Henüz bir gönderi kaydetmedin
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Sonra yeniden okumak istediğin konuları kaydettiğinde burada
          bulabilirsin.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 min-[360px]:flex-row">
          <Link
            href="/akis"
            className={campusButton.primary}
          >
            Akışa göz at
          </Link>
          <Link
            href="/kesfet"
            className={campusButton.secondary}
          >
            Keşfet&apos;e git
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[17px]"
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

function CommentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[17px]"
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

function BookmarkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-[17px]"
    >
      <path
        d="M5.2 3.2h9.6v13.6L10 13.9l-4.8 2.9V3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
