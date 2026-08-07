"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { campusButton } from "@/components/campusButtonStyles";
import CampusCalendarStrip from "@/components/CampusCalendarStrip";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCategoryNav, {
  type CampusCategoryFilter,
} from "@/components/CampusCategoryNav";
import { useCampusData } from "@/components/CampusDataProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import CampusHiddenNotice from "@/components/CampusHiddenNotice";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostActions from "@/components/CampusPostActions";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostDocument from "@/components/CampusPostDocument";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import {
  useCampusPostQuery,
  useDebouncedValue,
} from "@/components/useCampusPostQuery";
import { toContentCategory } from "@/content/adapter";
import type { ContentPostSort } from "@/content/client";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
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
  const router = useRouter();
  const { showToast } = useFeedback();
  const { isGuest } = useCampusAccount();
  const {
    posts: dataPosts,
    toggleLike,
    toggleBookmark,
    registerPosts,
  } = useCampusData();
  // Misafirin beğeni/kaydetme tıklaması mutasyon yerine giriş daveti açar;
  // düzen herkes için aynı kalır, yalnızca sonuç farklıdır.
  const requireMember = () => {
    if (!isGuest) {
      return false;
    }

    showToast({
      message: "Bu işlem için giriş yap veya kayıt ol.",
      tone: "info",
      action: { label: "Giriş yap", onClick: () => router.push("/giris") },
    });
    return true;
  };
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<CampusCategoryFilter>("Tümü");
  const [activeSort, setActiveSort] =
    useState<ContentPostSort>("trending");
  const [hasDocumentOnly, setHasDocumentOnly] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim());
  const searchTerm =
    debouncedQuery.length >= SEARCH_MIN_LENGTH ? debouncedQuery : undefined;

  const {
    posts: queriedPosts,
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
    hasDocument: hasDocumentOnly || undefined,
    sort: activeSort,
    // Misafirin oturumu yok; gerçek /v1/posts isteği atmak yerine aşağıda
    // sabit misafir verisi üzerinde aynı arama/kategori/sıralama uygulanır.
    enabled: !isGuest,
  });

  // Beğen/kaydet, gönderinin CampusDataProvider'ın paylaşılan listesinde
  // kayıtlı olmasını gerektiriyor (bkz. registerPosts tanımı). Keşfet kendi
  // sorgusunu ayrı çalıştırdığı için sonuçları oraya kaydediyoruz; aksi
  // halde beğeni/kaydet düğmeleri sessizce hiçbir şey yapmaz.
  useEffect(() => {
    registerPosts(queriedPosts);
  }, [queriedPosts, registerPosts]);

  // Misafirde gerçek API'ye hiç gidilmiyor; aynı arama/kategori/sıralama
  // sabit misafir verisi üzerinde istemci tarafında uygulanıyor.
  const guestVisiblePosts = useMemo(() => {
    if (!isGuest) {
      return [];
    }

    const normalizedQuery = searchTerm?.toLocaleLowerCase("tr-TR");

    const filtered = dataPosts.filter((post) => {
      if (activeCategory !== "Tümü" && post.category !== activeCategory) {
        return false;
      }

      if (hasDocumentOnly && !post.document) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${post.title} ${post.body}`.toLocaleLowerCase(
        "tr-TR",
      );
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((first, second) =>
      activeSort === "popular"
        ? second.likes - first.likes
        : second.createdAt - first.createdAt,
    );
  }, [
    activeCategory,
    activeSort,
    dataPosts,
    hasDocumentOnly,
    isGuest,
    searchTerm,
  ]);

  const visiblePosts = isGuest ? guestVisiblePosts : queriedPosts;

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("Tümü");
    setHasDocumentOnly(false);
  };

  return (
    <section
      aria-labelledby="explore-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.13em] text-[#ff7a45]">
              Kampüste ara
            </p>
            <h1
              id="explore-title"
              className="mt-0.5 text-2xl font-black tracking-[-0.04em] sm:text-3xl"
            >
              Keşfet
            </h1>
          </div>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="shrink-0 justify-self-end text-right text-sm font-bold text-white/55"
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
              className={`min-h-14 w-full rounded-full border border-white/12 bg-white/5 py-3 pr-12 pl-12 text-base font-medium text-white placeholder:text-white/45 ${focusRing}`}
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
        <div
          role="group"
          aria-label="Arama sonuçlarını sırala ve filtrele"
          className="flex flex-nowrap items-center gap-1 overflow-x-auto px-3 py-2 sm:px-5 lg:px-6 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {sortOptions.map((sort) => {
            const isActive = activeSort === sort.id;

            return (
              <button
                key={sort.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveSort(sort.id)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-bold whitespace-nowrap transition-colors sm:px-5 sm:text-sm ${focusRing} ${
                  isActive
                    ? "bg-white text-[#12100e]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {sort.label}
              </button>
            );
          })}
          <CampusCategoryNav
            activeCategory={activeCategory}
            ariaLabel="Keşfet kategorileri"
            onCategoryChange={setActiveCategory}
            hasDocumentOnly={hasDocumentOnly}
            onToggleDocumentOnly={() =>
              setHasDocumentOnly((value) => !value)
            }
          />
        </div>
      </div>

      {isLoading ? (
        <ExploreLoadingState />
      ) : hasFailed ? (
        <ExploreErrorState onReload={reload} />
      ) : visiblePosts.length > 0 ? (
        <ol className="min-w-0">
          {visiblePosts.map((post) => (
            <li key={post.id} className="campus-feed-enter">
              <CampusPostCardSurface
                postId={post.id}
                className="border-b border-white/12 px-4 py-6 sm:bg-white/[0.015] sm:px-6 sm:py-6"
              >
                <header className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
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
                        size="lg"
                      />
                    </CampusAuthorProfileLink>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                          className="size-1 rotate-45 bg-[#ff7a45]/55"
                        />
                        <CampusAuthorProfileLink
                          author={post.author}
                          authorId={post.authorId}
                          isAnonymous={post.isAnonymous}
                          ariaLabel={`${post.author} profilini aç`}
                          className="min-w-0"
                          linkClassName={`truncate text-sm font-black transition-colors hover:text-[#ff7a45] sm:text-base ${focusRing}`}
                        >
                          <span className="truncate text-sm font-black sm:text-base">
                            {post.author}
                          </span>
                        </CampusAuthorProfileLink>
                      </div>
                      {!isAnonymousCampusAuthor(post) && post.detail && (
                        <p className="mt-1 font-mono text-xs uppercase tracking-[0.07em] text-white/58 sm:text-[13px]">
                          {post.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="-mr-2 flex shrink-0 items-center gap-0.5">
                    <time className="text-xs font-semibold text-white/58 sm:text-sm">
                      {post.time}
                      {post.edited && !post.isDeleted ? " · düzenlendi" : ""}
                    </time>
                    <CampusPostActions post={post} />
                  </div>
                </header>

                {post.isDeleted ? (
                  <div className="mt-4 border border-dashed border-white/12 bg-white/[0.025] px-4 py-4">
                    <p className="text-base font-black sm:text-lg">
                      Bu gönderi kaldırıldı.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                      Konuşma bağlamı korundu; varsa yorumları hâlâ
                      görüntüleyebilirsin.
                    </p>
                    {getCampusPostCommentCount(post) > 0 && (
                      <Link
                        href={`/gonderi/${post.id}#yorumlar`}
                        className={`mt-2 inline-flex min-h-11 items-center text-sm font-black text-[#ff7a45] sm:text-base ${focusRing}`}
                      >
                        {getCampusPostCommentCount(post)} yorumu görüntüle
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {post.title && (
                      <h2 className="mt-4 max-w-[74ch] break-words text-xl font-black leading-7 tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-2xl sm:leading-8">
                        <Link
                          href={`/gonderi/${post.id}`}
                          aria-label={`${post.title} konusunu aç`}
                          className={`decoration-[#ff7a45]/40 underline-offset-4 transition-colors hover:text-[#ff7a45] hover:underline ${focusRing}`}
                        >
                          {post.title}
                        </Link>
                      </h2>
                    )}

                    {post.isHidden && <CampusHiddenNotice />}

                    {post.listing && (
                      <CampusListingMeta listing={post.listing} />
                    )}

                    {post.body && (
                      <p className="mt-2.5 max-w-[74ch] whitespace-pre-wrap break-words text-base leading-7 tracking-[-0.01em] text-white/78 [overflow-wrap:anywhere] sm:text-lg sm:leading-8">
                        {post.body}
                      </p>
                    )}

                    {post.image && <CampusPostImage image={post.image} />}
                    {post.gif && <CampusGif gif={post.gif} />}
                    {post.document && (
                      <CampusPostDocument document={post.document} />
                    )}
                    {post.poll && (
                      <CampusPoll postId={post.id} poll={post.poll} />
                    )}

                    {/* Düzen misafir/üye için birebir aynı; misafirin
                        tıklaması yalnızca giriş daveti açar. */}
                    <footer className="mt-5 flex items-center justify-between gap-2 sm:mt-6">
                      <div className="flex min-w-0 items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={post.liked}
                          aria-label={
                            post.liked
                              ? `${post.title || "Gönderi"} gönderisindeki beğeniyi kaldır, ${post.likes} beğeni`
                              : `${post.title || "Gönderi"} gönderisini beğen, ${post.likes} beğeni`
                          }
                          onClick={() => {
                            if (!requireMember()) {
                              toggleLike(post.id);
                            }
                          }}
                          className={`campus-pop-on-active inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold transition-colors sm:text-base ${focusRing} ${
                            post.liked
                              ? "bg-[#ff7a45]/10 text-[#ff7a45]"
                              : "text-white/55 hover:bg-white/4 hover:text-[#ff7a45]"
                          }`}
                        >
                          <HeartIcon filled={post.liked} />
                          <span aria-live="polite" aria-atomic="true">
                            {post.likes}
                          </span>
                          <span className="hidden min-[430px]:inline">
                            beğeni
                          </span>
                        </button>

                        <Link
                          href={`/gonderi/${post.id}#yorumlar`}
                          aria-label={`${post.title || "Gönderi"} konusunun ${getCampusPostCommentCount(post)} yorumunu aç`}
                          className={`inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-white/60 transition-colors hover:text-[#ff7a45] sm:text-base ${focusRing}`}
                        >
                          <CommentIcon />
                          <span>{getCampusPostCommentCount(post)}</span>
                          <span className="hidden min-[430px]:inline">
                            yorum
                          </span>
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
                        onClick={() => {
                          if (!requireMember()) {
                            toggleBookmark(post.id);
                          }
                        }}
                        className={`campus-pop-on-active grid size-12 shrink-0 place-items-center transition-colors ${focusRing} ${
                          post.bookmarked
                            ? "text-[#ff7a45]"
                            : "text-white/55 hover:text-[#ff7a45]"
                        }`}
                      >
                        <BookmarkIcon filled={post.bookmarked} />
                      </button>
                    </footer>
                  </>
                )}
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
            className={campusButton.secondary}
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
              className={`mt-5 ${campusButton.primary} `}
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
          className={`mt-5 ${campusButton.primary} `}
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="size-5 sm:size-[22px]"
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
      className="size-5 sm:size-[22px]"
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
      className="size-6"
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
