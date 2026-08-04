"use client";

import Link from "next/link";
import { useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusCalendarStrip from "@/components/CampusCalendarStrip";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCategoryNav, {
  type CampusCategoryFilter,
} from "@/components/CampusCategoryNav";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import {
  useCampusPostQuery,
  useDebouncedValue,
} from "@/components/useCampusPostQuery";
import { toContentCategory } from "@/content/adapter";
import type { ContentPostSort } from "@/content/client";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
} from "@/data/campusPosts";

const SEARCH_MIN_LENGTH = 2;

const sortOptions: { id: ContentPostSort; label: string }[] = [
  { id: "trending", label: "Yükselen" },
  { id: "newest", label: "Yeni" },
  { id: "popular", label: "En çok beğenilen" },
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

export default function CampusExplore() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<CampusCategoryFilter>("Tümü");
  const [activeSort, setActiveSort] =
    useState<ContentPostSort>("trending");
  const debouncedQuery = useDebouncedValue(query.trim());
  const searchTerm =
    debouncedQuery.length >= SEARCH_MIN_LENGTH ? debouncedQuery : undefined;

  const {
    posts: visiblePosts,
    isLoading,
    hasFailed,
    hasMore,
    isLoadingMore,
    loadMore,
    reload,
  } = useCampusPostQuery({
    q: searchTerm,
    category:
      activeCategory === "Tümü"
        ? undefined
        : toContentCategory(activeCategory),
    sort: activeSort,
  });

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("Tümü");
  };

  return (
    <section
      aria-labelledby="explore-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-white/10 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#ff7a45]">
              Kampüste ara
            </p>
            <h1
              id="explore-title"
              className="mt-0.5 text-xl font-black tracking-[-0.04em]"
            >
              Keşfet
            </h1>
          </div>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="shrink-0 justify-self-end text-right text-xs font-bold text-white/55"
          >
            {isLoading
              ? "Aranıyor"
              : `${visiblePosts.length}${hasMore ? "+" : ""} sonuç`}
          </p>
        </div>

        <div className="px-4 pb-4 sm:px-6">
          <label htmlFor="campus-search" className="sr-only">
            Kampüs gönderilerinde ara
          </label>
          <div className="relative">
            <SearchIcon />
            <input
              id="campus-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Başlık, kategori veya kullanıcı ara"
              autoComplete="off"
              className={`min-h-12 w-full rounded-full border border-white/12 bg-white/5 py-2.5 pr-12 pl-11 text-sm font-medium text-white placeholder:text-white/45 ${focusRing}`}
            />
            {query && (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => setQuery("")}
                className={`absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/7 hover:text-white ${focusRing}`}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Takvim mobil alt menüde yer bulamadığı için giriş noktası burada. */}
      <CampusCalendarStrip className="md:hidden" />

      <div className="border-b border-white/8">
        <CampusCategoryNav
          activeCategory={activeCategory}
          ariaLabel="Keşfet kategorileri"
          onCategoryChange={setActiveCategory}
        />

        <div
          role="group"
          aria-label="Arama sonuçlarını sırala"
          className="flex flex-wrap gap-1 px-3 py-2 sm:px-5 lg:px-6"
        >
          {sortOptions.map((sort) => {
            const isActive = activeSort === sort.id;

            return (
              <button
                key={sort.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveSort(sort.id)}
                className={`min-h-11 rounded-full px-3 text-[11px] font-bold transition-colors sm:px-4 sm:text-xs ${focusRing} ${
                  isActive
                    ? "bg-white text-[#12100e]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <ExploreLoadingState />
      ) : hasFailed ? (
        <ExploreErrorState onReload={reload} />
      ) : visiblePosts.length > 0 ? (
        <ol className="grid px-3 py-3 sm:px-5 sm:py-4 lg:px-6 2xl:grid-cols-2 2xl:gap-4">
          {visiblePosts.map((post) => (
            <li
              key={post.id}
              className="border-b border-white/9 last:border-b-0 2xl:border 2xl:bg-white/1.5 2xl:px-5 2xl:last:border-b"
            >
              <CampusPostCardSurface
                postId={post.id}
                className="py-5 sm:py-6"
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
                      className="size-1 rotate-45 bg-[#ff7a45]/55"
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
                <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-sm leading-6 tracking-[-0.01em] text-white/70 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-7">
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

                <footer className="mt-4 flex min-h-11 items-center gap-4 text-xs font-bold text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <HeartIcon />
                    {post.likes} beğeni
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CommentIcon />
                    {getCampusPostCommentCount(post)} yorum
                  </span>
                </footer>
              </CampusPostCardSurface>
            </li>
          ))}
        </ol>
      ) : null}

      {!isLoading && !hasFailed && visiblePosts.length > 0 && hasMore && (
        <div className="px-4 pb-6 text-center sm:px-6">
          <button
            type="button"
            aria-label="Daha fazla sonuç yükle"
            aria-busy={isLoadingMore}
            disabled={isLoadingMore}
            onClick={() => void loadMore().catch(() => undefined)}
            className={`inline-flex min-h-12 items-center justify-center border border-white/12 bg-white/[0.035] px-5 text-sm font-black text-white transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
          >
            {isLoadingMore ? "Sonuçlar yükleniyor…" : "Daha fazla sonuç yükle"}
          </button>
        </div>
      )}

      {!isLoading && !hasFailed && visiblePosts.length === 0 && (
        <div className="grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6">
          <div className="max-w-sm">
            <span
              aria-hidden="true"
              className="mx-auto grid size-12 place-items-center rounded-full border border-white/11 text-[#ff7a45]"
            >
              <SearchIcon standalone />
            </span>
            <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
              Eşleşen bir konu bulunamadı
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Arama kelimeni değiştir veya tüm kategorilere geri dön.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-5 inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
            >
              Aramayı temizle
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ExploreLoadingState() {
  return (
    <div
      role="status"
      aria-label="Sonuçlar yükleniyor"
      className="grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6"
    >
      <div>
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff7a45] motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-bold text-white/60">
          Sonuçlar yükleniyor…
        </p>
      </div>
    </div>
  );
}

function ExploreErrorState({ onReload }: { onReload: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6">
      <div className="max-w-sm">
        <h2 className="text-lg font-black tracking-[-0.03em]">
          Arama tamamlanamadı
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Bağlantı kurulamadı. Birazdan yeniden deneyebilirsin.
        </p>
        <button
          type="button"
          onClick={onReload}
          className={`mt-5 inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
        >
          Yeniden dene
        </button>
      </div>
    </div>
  );
}

function SearchIcon({ standalone = false }: { standalone?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={
        standalone
          ? "size-5"
          : "pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-white/45"
      }
    >
      <circle
        cx="10.8"
        cy="10.8"
        r="6.3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m15.6 15.6 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-4"
    >
      <path
        d="m5.5 5.5 9 9m0-9-9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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
