"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostImage from "@/components/CampusPostImage";
import { isAnonymousCampusAuthor } from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf8f1] dark:focus-visible:ring-[#c7896d]/30 dark:focus-visible:ring-offset-[#17191c]";

export default function CampusSavedPosts() {
  const { posts, isHydrated, toggleBookmark } = useCampusData();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [removedPost, setRemovedPost] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const savedPosts = useMemo(
    () =>
      posts
        .filter((post) => post.bookmarked)
        .sort(
          (first, second) =>
            second.createdAt - first.createdAt ||
            second.id.localeCompare(first.id, "tr"),
        ),
    [posts],
  );

  const removeSavedPost = (postId: string, title: string) => {
    toggleBookmark(postId);
    setRemovedPost({ id: postId, title });
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const undoRemoval = () => {
    if (!removedPost) {
      return;
    }

    toggleBookmark(removedPost.id);
    setRemovedPost(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  return (
    <section
      aria-labelledby="saved-posts-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/12 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#7d3c2d] dark:text-[#c7896d]">
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
            className="sr-only shrink-0 justify-self-end text-right text-xs font-bold text-[#1c2821]/55 min-[420px]:not-sr-only dark:text-white/52"
          >
            {isHydrated
              ? `${savedPosts.length} kayıt`
              : "Kayıtlar yükleniyor"}
          </p>
        </div>
      </header>

      {removedPost && (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-12 items-center justify-between gap-3 border-b border-[#1c2821]/10 bg-[#eee9e1]/65 px-4 text-xs font-semibold dark:border-white/8 dark:bg-white/[0.035] sm:px-6"
        >
          <span className="min-w-0 truncate">
            “{removedPost.title}” kaydedilenlerden kaldırıldı.
          </span>
          <button
            type="button"
            onClick={undoRemoval}
            className={`inline-flex min-h-11 shrink-0 items-center px-2 font-black text-[#7d3c2d] underline decoration-[#9a5944]/35 underline-offset-4 dark:text-[#d09272] ${focusRing}`}
          >
            Geri al
          </button>
        </div>
      )}

      {!isHydrated ? (
        <SavedPostsLoading />
      ) : savedPosts.length > 0 ? (
        <ol className="grid min-w-0 px-3 py-3 sm:px-5 sm:py-4 lg:px-6 2xl:grid-cols-2 2xl:gap-4">
          {savedPosts.map((post) => (
            <li
              key={post.id}
              className="min-w-0 border-b border-[#1c2821]/11 last:border-b-0 dark:border-white/9 2xl:border 2xl:bg-white/20 2xl:px-5 2xl:last:border-b dark:2xl:bg-white/[0.015]"
            >
              <article className="flex h-full min-w-0 flex-col py-5 sm:py-6">
                <header className="flex items-start gap-2.5">
                  <CampusAuthorAvatar
                    author={post.author}
                    authorId={post.authorId}
                    isAnonymous={post.isAnonymous}
                    size="sm"
                  />
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d3c2d] dark:text-[#d09272]">
                      {post.category}
                    </span>
                    <span
                      aria-hidden="true"
                      className="size-1 rotate-45 bg-[#9a5944]/55 dark:bg-[#c7896d]/58"
                    />
                    <span className="truncate text-xs font-black">
                      {post.author}
                    </span>
                    {!isAnonymousCampusAuthor(post) &&
                      post.detail && (
                        <span className="text-[11px] font-semibold text-[#1c2821]/50 dark:text-white/46">
                          {post.detail}
                        </span>
                      )}
                    <span
                      aria-hidden="true"
                      className="text-[#1c2821]/32 dark:text-white/28"
                    >
                      ·
                    </span>
                    <time className="text-[11px] font-semibold text-[#1c2821]/50 dark:text-white/46">
                      {post.time}
                    </time>
                  </div>
                </header>

                <h2 className="mt-2.5 max-w-[78ch] text-lg font-black leading-6 tracking-[-0.025em] sm:text-xl sm:leading-7">
                  <Link
                    href={`/gonderi/${post.id}`}
                    className={`decoration-[#9a5944]/30 underline-offset-4 transition-colors hover:text-[#7d3c2d] hover:underline dark:hover:text-[#d09272] ${focusRing}`}
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

                <p className="mt-2 line-clamp-3 max-w-[78ch] whitespace-pre-wrap text-sm leading-6 tracking-[-0.01em] text-[#1c2821]/76 dark:text-white/74 sm:text-[15px] sm:leading-7">
                  {post.body}
                </p>

                {post.image && (
                  <CampusPostImage image={post.image} variant="compact" />
                )}
                {post.poll && (
                  <CampusPoll
                    postId={post.id}
                    poll={post.poll}
                    compact
                  />
                )}

                <footer className="mt-auto flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs font-bold text-[#1c2821]/54 dark:text-white/50">
                  <span className="inline-flex min-h-11 items-center gap-1.5">
                    <HeartIcon />
                    {post.likes} beğeni
                  </span>
                  <span className="inline-flex min-h-11 items-center gap-1.5">
                    <CommentIcon />
                    {post.comments.length} yorum
                  </span>
                  <button
                    type="button"
                    aria-label={`“${post.title}” kaydını kaldır`}
                    onClick={() => removeSavedPost(post.id, post.title)}
                    className={`ml-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-[#7d3c2d] transition-colors hover:bg-[#5a1f32]/6 hover:text-[#5a1f32] dark:text-[#d09272] dark:hover:bg-[#c7896d]/8 dark:hover:text-[#e0aa8d] ${focusRing}`}
                  >
                    <BookmarkIcon />
                    Kaydı kaldır
                  </button>
                </footer>
              </article>
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
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-[#1c2821]/15 border-t-[#8f3427] dark:border-white/14 dark:border-t-[#c7896d]"
        />
        <p className="mt-4 text-sm font-bold text-[#1c2821]/62 dark:text-white/60">
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
          className="mx-auto grid size-12 place-items-center rounded-full border border-[#1c2821]/13 text-[#7d3c2d] dark:border-white/11 dark:text-[#d09272]"
        >
          <BookmarkIcon />
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          Henüz bir gönderi kaydetmedin
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#1c2821]/60 dark:text-white/56">
          Sonra yeniden okumak istediğin konuları kaydettiğinde burada
          bulabilirsin.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 min-[360px]:flex-row">
          <Link
            href="/akis"
            className={`inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-4 text-xs font-bold text-[#fffaf4] transition-colors hover:bg-[#6b2940] dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
          >
            Akışa göz at
          </Link>
          <Link
            href="/kesfet"
            className={`inline-flex min-h-11 items-center justify-center border border-[#1c2821]/14 px-4 text-xs font-bold transition-colors hover:border-[#5a1f32]/35 hover:bg-[#5a1f32]/5 dark:border-white/12 dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/7 ${focusRing}`}
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
