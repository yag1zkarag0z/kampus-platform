"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCategoryNav, {
  type CampusCategoryFilter,
} from "@/components/CampusCategoryNav";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
  type CampusPost,
} from "@/data/campusPosts";

type ExploreSort = "rising" | "latest" | "liked";

const sortOptions: { id: ExploreSort; label: string }[] = [
  { id: "rising", label: "Yükselen" },
  { id: "latest", label: "Yeni" },
  { id: "liked", label: "En çok beğenilen" },
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:focus-visible:ring-[#c7896d]/30";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .trim();
}

function comparePostIds(first: CampusPost, second: CampusPost) {
  return first.id.localeCompare(second.id, "tr");
}

export default function CampusExplore() {
  const { posts } = useCampusData();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<CampusCategoryFilter>("Tümü");
  const [activeSort, setActiveSort] = useState<ExploreSort>("rising");

  const visiblePosts = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    const filteredPosts = posts.filter((post) => {
      if (post.isDeleted) {
        return false;
      }

      const matchesCategory =
        activeCategory === "Tümü" || post.category === activeCategory;
      const searchableContent = normalizeSearchValue(
        [
          post.title,
          post.body,
          post.category,
          post.author,
          isAnonymousCampusAuthor(post) ? "" : (post.detail ?? ""),
          post.poll?.options.map((option) => option.text).join(" ") ??
            "",
          post.listing
            ? `${post.listing.type} ${post.listing.condition} ${post.listing.price} TL`
            : "",
        ].join(" ")
      );

      return (
        matchesCategory &&
        (!normalizedQuery || searchableContent.includes(normalizedQuery))
      );
    });

    return [...filteredPosts].sort((first, second) => {
      if (activeSort === "liked") {
        return (
          second.likes - first.likes ||
          getCampusPostCommentCount(second) -
            getCampusPostCommentCount(first) ||
          second.createdAt - first.createdAt ||
          comparePostIds(first, second)
        );
      }

      if (activeSort === "latest") {
        return (
          second.createdAt - first.createdAt ||
          comparePostIds(first, second)
        );
      }

      const firstRisingScore =
        first.likes * 2 +
        getCampusPostCommentCount(first) * 4 +
        first.createdAt * 3;
      const secondRisingScore =
        second.likes * 2 +
        getCampusPostCommentCount(second) * 4 +
        second.createdAt * 3;

      return (
        secondRisingScore - firstRisingScore ||
        second.createdAt - first.createdAt ||
        comparePostIds(first, second)
      );
    });
  }, [activeCategory, activeSort, posts, query]);

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("Tümü");
  };

  return (
    <section
      aria-labelledby="explore-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/12 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-[#7d3c2d] dark:text-[#c7896d]">
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
            className="shrink-0 justify-self-end text-right text-xs font-bold text-[#58635c] dark:text-[#aeb4af]"
          >
            {visiblePosts.length} sonuç
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
              className={`min-h-12 w-full rounded-full border border-[#1c2821]/14 bg-[#f8f4ed]/84 py-2.5 pr-12 pl-11 text-sm font-medium text-[#1c2821] placeholder:text-[#667169] dark:border-white/12 dark:bg-white/5 dark:text-[#ece8e1] dark:placeholder:text-[#9ca39f] ${focusRing}`}
            />
            {query && (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => setQuery("")}
                className={`absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-[#58635c] transition-colors hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/7 dark:hover:text-white ${focusRing}`}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-[#1c2821]/10 dark:border-white/8">
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
                    ? "bg-[#5a1f32] text-[#fffaf4] dark:bg-[#9a5944] dark:text-[#121417]"
                    : "text-[#58635c] hover:bg-[#1c2821]/5 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
      </div>

      {visiblePosts.length > 0 ? (
        <ol className="grid px-3 py-3 sm:px-5 sm:py-4 lg:px-6 2xl:grid-cols-2 2xl:gap-4">
          {visiblePosts.map((post) => (
            <li
              key={post.id}
              className="border-b border-[#1c2821]/11 last:border-b-0 dark:border-white/9 2xl:border 2xl:bg-white/20 2xl:px-5 2xl:last:border-b dark:2xl:bg-white/[0.015]"
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
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d3c2d] dark:text-[#d09272]">
                      {post.category}
                    </span>
                    <span
                      aria-hidden="true"
                      className="size-1 rotate-45 bg-[#9a5944]/55 dark:bg-[#c7896d]/58"
                    />
                    <CampusAuthorProfileLink
                      author={post.author}
                      authorId={post.authorId}
                      isAnonymous={post.isAnonymous}
                      ariaLabel={`${post.author} profilini aç`}
                      className="min-w-0"
                      linkClassName={`truncate text-xs font-black transition-colors hover:text-[#5a1f32] dark:hover:text-[#d09272] ${focusRing}`}
                    >
                      <span className="truncate text-xs font-black">
                        {post.author}
                      </span>
                    </CampusAuthorProfileLink>
                    {!isAnonymousCampusAuthor(post) &&
                      post.detail && (
                        <span className="text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]">
                          {post.detail}
                        </span>
                      )}
                    <span
                      aria-hidden="true"
                      className="text-[#1c2821]/32 dark:text-white/28"
                    >
                      ·
                    </span>
                    <time className="text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]">
                      {post.time}
                    </time>
                  </div>
                </header>

                <h2 className="mt-2.5 max-w-[78ch] break-words text-lg font-black leading-6 tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-xl sm:leading-7">
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
                <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-sm leading-6 tracking-[-0.01em] text-[#1c2821]/76 [overflow-wrap:anywhere] dark:text-white/74 sm:text-[15px] sm:leading-7">
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

                <footer className="mt-4 flex min-h-11 items-center gap-4 text-xs font-bold text-[#58635c] dark:text-[#aeb4af]">
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
      ) : (
        <div className="grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6">
          <div className="max-w-sm">
            <span
              aria-hidden="true"
              className="mx-auto grid size-12 place-items-center rounded-full border border-[#1c2821]/13 text-[#7d3c2d] dark:border-white/11 dark:text-[#d09272]"
            >
              <SearchIcon standalone />
            </span>
            <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
              Eşleşen bir konu bulunamadı
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
              Arama kelimeni değiştir veya tüm kategorilere geri dön.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-5 inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-4 text-xs font-bold text-[#fffaf4] transition-colors hover:bg-[#6b2940] dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
            >
              Aramayı temizle
            </button>
          </div>
        </div>
      )}
    </section>
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
          : "pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[#1c2821]/48 dark:text-white/46"
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
