"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCampusData } from "@/components/CampusDataProvider";
import type { CampusPostCategory } from "@/data/campusPosts";

type FeedSort = "latest" | "trending" | "top";
type CategoryFilter = "Tümü" | CampusPostCategory;

const feedSorts: { id: FeedSort; label: string }[] = [
  { id: "latest", label: "Yeni" },
  { id: "trending", label: "Gündem" },
  { id: "top", label: "En çok beğenilen" },
];

const categories: CategoryFilter[] = [
  "Tümü",
  "İtiraf",
  "Soru",
  "Etkinlik",
  "Kayıp Eşya",
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:focus-visible:ring-[#c7896d]/30";

export default function CampusFeed() {
  const { posts, toggleLike, toggleBookmark } = useCampusData();
  const [activeSort, setActiveSort] = useState<FeedSort>("latest");
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilter>("Tümü");

  const visiblePosts = useMemo(() => {
    const filtered =
      activeCategory === "Tümü"
        ? posts
        : posts.filter((post) => post.category === activeCategory);

    return [...filtered].sort((first, second) => {
      if (activeSort === "top") {
        return (
          second.likes - first.likes ||
          second.comments.length - first.comments.length ||
          second.createdAt - first.createdAt
        );
      }

      if (activeSort === "trending") {
        const firstTrendRank =
          first.likes * 2 +
          first.comments.length * 4 +
          first.createdAt * 0.75;
        const secondTrendRank =
          second.likes * 2 +
          second.comments.length * 4 +
          second.createdAt * 0.75;

        return (
          secondTrendRank - firstTrendRank ||
          second.createdAt - first.createdAt
        );
      }

      return second.createdAt - first.createdAt;
    });
  }, [activeCategory, activeSort, posts]);

  return (
    <section
      aria-labelledby="campus-feed-title"
      className="min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1]"
    >
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/14 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f3427] dark:text-[#c7896d]">
              Yaşar&apos;da bugün
            </p>
            <h1
              id="campus-feed-title"
              className="mt-0.5 truncate text-xl font-black tracking-[-0.04em]"
            >
              Kampüs gündemi
            </h1>
          </div>

          <Link
            href="/konu-olustur"
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border border-[#5a1f32]/22 px-3 text-xs font-bold text-[#5a1f32] transition-colors hover:border-[#5a1f32]/45 hover:bg-[#5a1f32]/6 dark:border-[#c7896d]/28 dark:text-[#d09272] dark:hover:border-[#c7896d]/55 dark:hover:bg-[#c7896d]/8 ${focusRing}`}
          >
            Konu aç
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div
          role="group"
          aria-label="Gönderi sıralaması"
          className="grid grid-cols-3 border-t border-[#1c2821]/10 dark:border-white/8"
        >
          {feedSorts.map((sort) => {
            const isActive = activeSort === sort.id;

            return (
              <button
                key={sort.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveSort(sort.id)}
                className={`relative min-h-12 px-2 text-[11px] font-bold transition-colors sm:text-xs ${focusRing} ${
                  isActive
                    ? "text-[#5a1f32] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[#9a5944] dark:text-[#d09272] dark:after:bg-[#c7896d] sm:after:inset-x-6"
                    : "text-[#1c2821]/55 hover:bg-[#1c2821]/4 hover:text-[#1c2821] dark:text-white/52 dark:hover:bg-white/4 dark:hover:text-white"
                }`}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
      </header>

      <nav
        aria-label="Gönderi kategorileri"
        className="overflow-x-auto border-b border-[#1c2821]/10 bg-[#fbf8f1] px-2 [scrollbar-width:none] dark:border-white/8 dark:bg-[#17191c] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max">
          {categories.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className={`min-h-11 border-b-2 px-3 text-[11px] font-bold transition-colors ${focusRing} ${
                  isActive
                    ? "border-[#9a5944] text-[#5a1f32] dark:border-[#c7896d] dark:text-[#d09272]"
                    : "border-transparent text-[#1c2821]/60 hover:text-[#1c2821] dark:text-white/58 dark:hover:text-white"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </nav>

      {visiblePosts.length > 0 ? (
        <ol className="sm:p-3">
          {visiblePosts.map((post) => (
            <li key={post.id} className="sm:mb-3 sm:last:mb-0">
              <article className="border-b border-[#1c2821]/14 px-4 py-5 dark:border-white/10 sm:border sm:bg-white/20 sm:px-5 sm:py-5 dark:sm:bg-white/[0.015]">
                <header className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#8f3427] dark:text-[#d09272]">
                        {post.category}
                      </span>
                      <span
                        aria-hidden="true"
                        className="size-1 rotate-45 bg-[#9a5944]/55 dark:bg-[#c7896d]/60"
                      />
                      <span className="truncate text-xs font-black">
                        {post.author}
                      </span>
                    </div>
                    {post.detail && (
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1c2821]/52 dark:text-white/48">
                        {post.detail}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] font-semibold text-[#1c2821]/52 dark:text-white/48">
                    {post.time}
                  </time>
                </header>

                <h2 className="mt-3 max-w-[78ch] text-lg font-black leading-6 tracking-[-0.025em] sm:mt-4 sm:text-xl sm:leading-7">
                  <Link
                    href={`/gonderi/${post.id}`}
                    aria-label={`${post.title} konusunu aç`}
                    className={`decoration-[#9a5944]/30 underline-offset-4 transition-colors hover:text-[#7d3c2d] hover:underline dark:hover:text-[#d09272] ${focusRing}`}
                  >
                    {post.title}
                  </Link>
                </h2>

                {post.body && (
                  <p className="mt-2 max-w-[78ch] text-[14px] leading-6 tracking-[-0.01em] text-[#1c2821]/82 dark:text-white/80 sm:text-[15px] sm:leading-7">
                    {post.body}
                  </p>
                )}

                <footer className="mt-4 flex items-center justify-between gap-2 sm:mt-5">
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={post.liked}
                      aria-label={
                        post.liked
                          ? `${post.title} gönderisindeki beğeniyi kaldır, ${post.likes} beğeni`
                          : `${post.title} gönderisini beğen, ${post.likes} beğeni`
                      }
                      onClick={() => toggleLike(post.id)}
                      className={`inline-flex min-h-11 items-center gap-2 px-2 text-xs font-bold transition-colors ${focusRing} ${
                        post.liked
                          ? "bg-[#8f3427]/10 text-[#8f3427] dark:bg-[#d09272]/12 dark:text-[#d09272]"
                          : "text-[#1c2821]/58 hover:bg-[#1c2821]/4 hover:text-[#8f3427] dark:text-white/54 dark:hover:bg-white/4 dark:hover:text-[#d09272]"
                      }`}
                    >
                      <HeartIcon filled={post.liked} />
                      <span aria-live="polite" aria-atomic="true">
                        {post.likes}
                      </span>
                      <span className="hidden min-[430px]:inline">beğeni</span>
                    </button>

                    <Link
                      href={`/gonderi/${post.id}#yorumlar`}
                      aria-label={`${post.title} konusunun ${post.comments.length} yorumunu aç`}
                      className={`inline-flex min-h-11 items-center gap-2 px-2 text-xs font-bold text-[#1c2821]/58 transition-colors hover:text-[#5a1f32] dark:text-white/54 dark:hover:text-[#d09272] ${focusRing}`}
                    >
                      <CommentIcon />
                      <span>{post.comments.length}</span>
                      <span className="hidden min-[430px]:inline">yorum</span>
                    </Link>
                  </div>

                  <button
                    type="button"
                    aria-pressed={post.bookmarked}
                    aria-label={
                      post.bookmarked
                        ? "Kaydedilenlerden çıkar"
                        : "Gönderiyi kaydet"
                    }
                    onClick={() => toggleBookmark(post.id)}
                    className={`grid size-11 shrink-0 place-items-center transition-colors ${focusRing} ${
                      post.bookmarked
                        ? "text-[#5a1f32] dark:text-[#d09272]"
                        : "text-[#1c2821]/50 hover:text-[#5a1f32] dark:text-white/48 dark:hover:text-[#d09272]"
                    }`}
                  >
                    <BookmarkIcon filled={post.bookmarked} />
                  </button>
                </footer>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-b border-[#1c2821]/14 px-4 py-14 text-center dark:border-white/10 sm:m-3 sm:border">
          <p className="text-sm font-black">
            Bu kategoride henüz bir konu yok.
          </p>
          <Link
            href="/konu-olustur"
            className={`mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[#8f3427] underline decoration-[#9a5944]/35 underline-offset-4 dark:text-[#d09272] ${focusRing}`}
          >
            İlk konuyu sen aç
          </Link>
        </div>
      )}
    </section>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="size-[18px]"
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
      className="size-[18px]"
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

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="size-[18px]"
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
