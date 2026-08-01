"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

export default function CampusSavedPosts() {
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

  const removeSavedPost = (postId: string, title: string) => {
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

    toggleBookmark(postId);
    showToast({
      message: `“${title || "Gönderi"}” kaydedilenlerden kaldırıldı.`,
      tone: "info",
      action: {
        label: "Geri al",
        onClick: () => toggleBookmark(postId),
      },
    });
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  return (
    <section
      aria-labelledby="saved-posts-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
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
              className="mt-0.5 truncate text-xl font-black tracking-[-0.04em] outline-none"
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
              ? `${savedPosts.length} kayıt`
              : "Kayıtlar yükleniyor"}
          </p>
        </div>
      </header>

      {!isHydrated ? (
        <SavedPostsLoading />
      ) : savedPosts.length > 0 ? (
        <ol className="grid min-w-0 px-3 py-3 sm:px-5 sm:py-4 lg:px-6 2xl:grid-cols-2 2xl:gap-4">
          {savedPosts.map((post) => (
            <li
              key={post.id}
              className="min-w-0 border-b border-white/9 last:border-b-0 2xl:border 2xl:bg-white/[0.015] 2xl:px-5 2xl:last:border-b"
            >
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
                      isAnonymous={post.isAnonymous}
                      size="sm"
                    />
                  </CampusAuthorProfileLink>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff7a45]">
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
                    {!isAnonymousCampusAuthor(post) &&
                      post.detail && (
                        <span className="text-[11px] font-semibold text-white/55">
                          {post.detail}
                        </span>
                      )}
                    <span
                      aria-hidden="true"
                      className="text-white/28"
                    >
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
                  <CampusListingMeta
                    listing={post.listing}
                    variant="compact"
                  />
                )}

                <p className="mt-2 line-clamp-3 max-w-[78ch] whitespace-pre-wrap break-words text-sm leading-6 tracking-[-0.01em] text-white/74 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-7">
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
                    onClick={() => removeSavedPost(post.id, post.title)}
                    className={`ml-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 hover:text-[#ff7a45]/80 ${focusRing}`}
                  >
                    <BookmarkIcon />
                    Kaydı kaldır
                  </button>
                </footer>
              </CampusPostCardSurface>
            </li>
          ))}
        </ol>
      ) : (
        <SavedPostsEmptyState />
      )}
    </section>
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
            className={`inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
          >
            Akışa göz at
          </Link>
          <Link
            href="/kesfet"
            className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-4 text-xs font-bold transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
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
