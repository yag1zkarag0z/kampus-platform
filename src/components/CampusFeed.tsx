"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  campusCategoryFilters,
  type CampusCategoryFilter,
} from "@/components/CampusCategoryNav";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostActions from "@/components/CampusPostActions";
import CampusPostImage from "@/components/CampusPostImage";
import {
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";
import { useFeedback } from "@/components/FeedbackProvider";

type FeedView = "latest" | "liked" | "saved";

const feedViews: { id: FeedView; label: string }[] = [
  { id: "latest", label: "En yeni" },
  { id: "liked", label: "En beğenilenler" },
  { id: "saved", label: "Kaydedilenler" },
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

export default function CampusFeed() {
  const { showToast } = useFeedback();
  const { isGuest } = useCampusAccount();
  const {
    posts,
    isHydrated,
    createPost,
    toggleLike,
    toggleBookmark,
  } = useCampusData();
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<FeedView>("latest");
  const [activeCategory, setActiveCategory] =
    useState<CampusCategoryFilter>("Tümü");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPostBody, setQuickPostBody] = useState("");
  const [quickPostMessage, setQuickPostMessage] = useState("");
  const [isQuickPostSubmitting, setIsQuickPostSubmitting] = useState(false);

  useEffect(() => {
    const closeCategoryMenu = (event: PointerEvent) => {
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(event.target as Node)
      ) {
        setIsCategoryMenuOpen(false);
      }
    };
    const closeCategoryMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeCategoryMenu);
    document.addEventListener("keydown", closeCategoryMenuWithKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeCategoryMenu);
      document.removeEventListener(
        "keydown",
        closeCategoryMenuWithKeyboard,
      );
    };
  }, []);

  const visiblePosts = useMemo(() => {
    const categoryPosts =
      activeCategory === "Tümü"
        ? posts
        : posts.filter((post) => post.category === activeCategory);
    const normalizedQuery = normalizeSearchValue(searchQuery);
    const searchedPosts = normalizedQuery
      ? categoryPosts.filter((post) =>
          normalizeSearchValue(
            [
              post.title,
              post.body,
              post.category,
              post.author,
              post.detail,
              post.poll?.options.map((option) => option.text).join(" "),
              post.listing
                ? `${post.listing.type} ${post.listing.condition} ${post.listing.price}`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          ).includes(normalizedQuery),
        )
      : categoryPosts;
    const filtered =
      activeView === "saved"
        ? searchedPosts.filter((post) => post.bookmarked)
        : searchedPosts;

    return [...filtered].sort((first, second) => {
      if (activeView === "liked") {
        return (
          second.likes - first.likes ||
          second.comments.length - first.comments.length ||
          second.createdAt - first.createdAt
        );
      }

      return second.createdAt - first.createdAt;
    });
  }, [activeCategory, activeView, posts, searchQuery]);

  const submitQuickPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = quickPostBody.trim();

    if (!body || !isHydrated || isQuickPostSubmitting) {
      setQuickPostMessage(
        body ? "Akış hazırlanıyor, tekrar dene." : "Önce bir şeyler yaz.",
      );
      return;
    }

    setIsQuickPostSubmitting(true);
    setQuickPostMessage("Gönderin paylaşılıyor…");

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 550));
      createPost({
        body,
        category: "Sohbet",
        isAnonymous: false,
      });
      setQuickPostBody("");
      setQuickPostMessage("");
      showToast({
        message: "Gönderin akışta paylaşıldı.",
        tone: "success",
      });
      setActiveView("latest");
      setActiveCategory("Tümü");
      setSearchQuery("");
    } catch {
      setQuickPostMessage("Gönderi paylaşılamadı. Tekrar dene.");
      showToast({
        message: "Gönderi paylaşılamadı. Tekrar dene.",
        tone: "error",
      });
    } finally {
      setIsQuickPostSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="campus-feed-title"
      className="mx-auto min-h-[calc(100svh-4rem)] w-full max-w-[900px] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] sm:border-x sm:border-[#1c2821]/10 dark:sm:border-white/9 md:min-h-svh"
    >
      <h1 id="campus-feed-title" className="sr-only">
        Kampüs akışı
      </h1>

      <header className="sticky top-16 z-30 border-b border-[#1c2821]/14 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="border-b border-[#1c2821]/10 px-3 py-3 dark:border-white/8 sm:px-4">
          <label htmlFor="campus-feed-search" className="sr-only">
            Kampüs akışında ara
          </label>
          <div className="relative">
            <input
              id="campus-feed-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Kampüste ara"
              autoComplete="off"
              className={`min-h-11 w-full rounded-full border border-[#1c2821]/13 bg-[#eee9e1]/72 px-4 pr-12 text-sm font-semibold text-[#1c2821] placeholder:text-[#667169] hover:border-[#5a1f32]/24 dark:border-white/11 dark:bg-white/5 dark:text-[#ece8e1] dark:placeholder:text-[#9ca39f] dark:hover:border-[#c7896d]/30 ${focusRing}`}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => setSearchQuery("")}
                className={`absolute top-1/2 right-1 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-base font-medium text-[#58635c] transition-colors hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/8 dark:hover:text-white ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        </div>

        <div
          role="group"
          aria-label="Akış görünümü"
          className="flex min-w-0"
        >
          <div
            className="grid min-w-0 flex-1 grid-cols-3"
          >
            {feedViews.map((view) => {
              const isActive = activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveView(view.id)}
                  className={`relative min-h-14 min-w-0 px-1 text-[10px] font-black transition-colors min-[380px]:px-2 min-[380px]:text-[11px] sm:text-xs ${focusRing} ${
                    isActive
                      ? "text-[#5a1f32] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[#9a5944] dark:text-[#d09272] dark:after:bg-[#c7896d] sm:after:inset-x-6"
                      : "text-[#58635c] hover:bg-[#1c2821]/4 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/4 dark:hover:text-white"
                  }`}
                >
                  <span className="block truncate">{view.label}</span>
                </button>
              );
            })}
          </div>

          <div
            ref={categoryMenuRef}
            className="relative shrink-0 border-l border-[#1c2821]/10 dark:border-white/8"
          >
            <button
              type="button"
              aria-label={`Kategori filtresi: ${activeCategory}`}
              aria-expanded={isCategoryMenuOpen}
              aria-controls="campus-feed-category-menu"
              onClick={() =>
                setIsCategoryMenuOpen((currentValue) => !currentValue)
              }
              className={`inline-flex min-h-14 min-w-12 items-center justify-center gap-1.5 px-2 text-xs font-black transition-colors hover:bg-[#1c2821]/4 dark:hover:bg-white/4 min-[460px]:min-w-28 min-[460px]:px-3 ${focusRing} ${
                activeCategory !== "Tümü"
                  ? "bg-[#ddd2c7] text-[#5a1f32] dark:bg-[#2c3034] dark:text-[#d09272]"
                  : "text-[#58635c] dark:text-[#aeb4af]"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                #
              </span>
              <span className="hidden max-w-20 truncate min-[460px]:inline">
                {activeCategory === "Tümü"
                  ? "Kategori"
                  : activeCategory}
              </span>
              <span
                aria-hidden="true"
                className={`hidden text-[10px] transition-transform min-[460px]:inline ${
                  isCategoryMenuOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

            {isCategoryMenuOpen && (
              <div
                id="campus-feed-category-menu"
                role="group"
                aria-label="Gönderi kategorileri"
                className="absolute top-[calc(100%+1px)] right-0 z-50 w-60 border border-[#1c2821]/14 bg-[#fffaf4] p-2 shadow-[0_20px_50px_rgba(28,40,33,0.16)] dark:border-white/12 dark:bg-[#202226] dark:shadow-[0_20px_50px_rgba(0,0,0,0.42)]"
              >
                <p className="px-2 pt-1 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#58635c] dark:text-[#aeb4af]">
                  Kategori seç
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {campusCategoryFilters.map((category) => {
                    const isActive = activeCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setActiveCategory(category);
                          setIsCategoryMenuOpen(false);
                        }}
                        className={`inline-flex min-h-11 items-center px-2.5 text-left text-[11px] font-bold transition-colors ${focusRing} ${
                          isActive
                            ? "bg-[#ddd2c7] text-[#5a1f32] dark:bg-[#2c3034] dark:text-[#d09272]"
                            : "text-[#58635c] hover:bg-[#eee7df] hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/6 dark:hover:text-white"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {isGuest ? (
        <section className="flex items-center justify-between gap-4 border-b border-[#1c2821]/14 bg-[#eee9e1]/55 px-4 py-4 dark:border-white/10 dark:bg-white/[0.025] sm:px-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.13em] text-[#d46a2f]">
              Misafir görünümü
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#1c2821]/64 dark:text-white/60">
              Misafir akışındaki 20 gönderiyi görüntülüyorsun.
            </p>
          </div>
          <Link
            href="/giris"
            className={`inline-flex min-h-11 shrink-0 items-center bg-[#1c2821] px-4 text-xs font-black text-white hover:bg-[#5a1f32] dark:bg-[#c7896d] dark:text-[#17191c] dark:hover:bg-[#d09272] ${focusRing}`}
          >
            Giriş yap
          </Link>
        </section>
      ) : (
        <form
          onSubmit={submitQuickPost}
          aria-labelledby="campus-composer-title"
          aria-busy={isQuickPostSubmitting}
          className="relative border-b border-[#1c2821]/14 px-4 py-4 dark:border-white/10 sm:px-5 sm:py-5"
        >
        <div className="flex items-center gap-3">
          <CampusAuthorAvatar
            author="@sen"
            authorId={LOCAL_ACCOUNT_OWNER_ID}
          />
          <h2 id="campus-composer-title" className="sr-only">
            Yeni gönderi başlat
          </h2>
          <textarea
            value={quickPostBody}
            onChange={(event) => {
              setQuickPostBody(event.target.value);
              setQuickPostMessage("");
            }}
            rows={1}
            maxLength={500}
            placeholder="Kampüste ne oluyor?"
            aria-label="Gönderi metni"
            className={`max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] font-semibold leading-6 text-[#1c2821] placeholder:text-[#667169] dark:text-[#ece8e1] dark:placeholder:text-[#9ca39f] sm:text-base ${focusRing}`}
          />
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-2 pl-11 sm:pl-[3.25rem]">
          <div
            role="group"
            aria-label="Gönderi araçları"
            className="flex min-w-0 items-center"
          >
            <ComposerAction symbol="▧" label="Fotoğraf ekle" />
            <ComposerAction
              symbol="☺"
              label="Emoji ekle"
              className="hidden min-[360px]:grid"
            />
            <ComposerAction symbol="☷" label="Anket oluştur" />
            <ComposerAction
              symbol="₺"
              label="İlan oluştur"
              className="hidden min-[430px]:grid"
            />
          </div>

          <button
            type="submit"
            disabled={
              !quickPostBody.trim() ||
              !isHydrated ||
              isQuickPostSubmitting
            }
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center bg-[#5a1f32] px-4 text-xs font-black text-white transition-colors hover:bg-[#6b2940] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] sm:px-5 ${focusRing}`}
          >
            {isQuickPostSubmitting ? "Paylaşılıyor" : "Paylaş"}
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="min-h-4 pt-1 pl-11 text-[11px] font-bold text-[#7d3c2d] dark:text-[#d09272] sm:pl-[3.25rem]"
        >
          {quickPostMessage}
        </p>

        {isQuickPostSubmitting && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#c7896d]/20"
          >
            <span className="block h-full w-full animate-pulse bg-[#d46a2f] motion-reduce:animate-none" />
          </span>
        )}
        </form>
      )}

      {visiblePosts.length > 0 ? (
        <ol className="sm:p-3">
          {visiblePosts.map((post) => (
            <li key={post.id} className="sm:mb-3 sm:last:mb-0">
              <article className="border-b border-[#1c2821]/14 px-4 py-5 dark:border-white/10 sm:border sm:bg-white/20 sm:px-5 sm:py-5 dark:sm:bg-white/[0.015]">
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
                        isAnonymous={post.isAnonymous}
                      />
                    </CampusAuthorProfileLink>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#8f3427] dark:text-[#d09272]">
                          {post.category}
                        </span>
                        <span
                          aria-hidden="true"
                          className="size-1 rotate-45 bg-[#9a5944]/55 dark:bg-[#c7896d]/60"
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
                      </div>
                      {!isAnonymousCampusAuthor(post) &&
                        post.detail && (
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#58635c] dark:text-[#aeb4af]">
                            {post.detail}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="-mr-2 flex shrink-0 items-center gap-0.5">
                    <time className="text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]">
                      {post.time}
                      {post.edited && !post.isDeleted ? " · düzenlendi" : ""}
                    </time>
                    <CampusPostActions post={post} />
                  </div>
                </header>

                {post.isDeleted ? (
                  <div className="mt-4 border border-dashed border-[#1c2821]/16 bg-[#eee9e1]/55 px-4 py-4 dark:border-white/12 dark:bg-white/[0.025]">
                    <p className="text-sm font-black">
                      Bu gönderi kaldırıldı.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                      Konuşma bağlamı korundu; varsa yorumları hâlâ
                      görüntüleyebilirsin.
                    </p>
                    {post.comments.length > 0 && (
                      <Link
                        href={`/gonderi/${post.id}#yorumlar`}
                        className={`mt-2 inline-flex min-h-11 items-center text-xs font-black text-[#7d3c2d] dark:text-[#d09272] ${focusRing}`}
                      >
                        {post.comments.length} yorumu görüntüle
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {post.title && (
                      <h2 className="mt-3 max-w-[78ch] break-words text-lg font-black leading-6 tracking-[-0.025em] [overflow-wrap:anywhere] sm:mt-4 sm:text-xl sm:leading-7">
                        <Link
                          href={`/gonderi/${post.id}`}
                          aria-label={`${post.title} konusunu aç`}
                          className={`decoration-[#9a5944]/30 underline-offset-4 transition-colors hover:text-[#7d3c2d] hover:underline dark:hover:text-[#d09272] ${focusRing}`}
                        >
                          {post.title}
                        </Link>
                      </h2>
                    )}

                    {post.listing && (
                      <CampusListingMeta listing={post.listing} />
                    )}

                    {post.body && (
                      <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-[14px] leading-6 tracking-[-0.01em] text-[#1c2821]/82 [overflow-wrap:anywhere] dark:text-white/80 sm:text-[15px] sm:leading-7">
                        {post.body}
                      </p>
                    )}

                    {post.image && <CampusPostImage image={post.image} />}
                    {post.poll && (
                      <CampusPoll postId={post.id} poll={post.poll} />
                    )}

                    {isGuest ? (
                  <footer className="mt-4 flex min-h-11 items-center justify-between gap-3 text-xs font-bold text-[#58635c] dark:text-[#aeb4af] sm:mt-5">
                    <span className="inline-flex items-center gap-2">
                      <HeartIcon filled={false} />
                      {post.likes} beğeni
                    </span>
                    <Link
                      href={`/gonderi/${post.id}`}
                      className={`inline-flex min-h-11 items-center px-2 text-[#7d3c2d] dark:text-[#d09272] ${focusRing}`}
                    >
                      Görüntüle
                    </Link>
                  </footer>
                ) : (
                  <footer className="mt-4 flex items-center justify-between gap-2 sm:mt-5">
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={post.liked}
                      aria-label={
                        post.liked
                          ? `${post.title || "Gönderi"} gönderisindeki beğeniyi kaldır, ${post.likes} beğeni`
                          : `${post.title || "Gönderi"} gönderisini beğen, ${post.likes} beğeni`
                      }
                      onClick={() => toggleLike(post.id)}
                      className={`inline-flex min-h-11 items-center gap-2 px-2 text-xs font-bold transition-colors ${focusRing} ${
                        post.liked
                          ? "bg-[#8f3427]/10 text-[#8f3427] dark:bg-[#d09272]/12 dark:text-[#d09272]"
                          : "text-[#58635c] hover:bg-[#1c2821]/4 hover:text-[#8f3427] dark:text-[#aeb4af] dark:hover:bg-white/4 dark:hover:text-[#d09272]"
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
                      aria-label={`${post.title || "Gönderi"} konusunun ${post.comments.length} yorumunu aç`}
                      className={`inline-flex min-h-11 items-center gap-2 px-2 text-xs font-bold text-[#58635c] transition-colors hover:text-[#5a1f32] dark:text-[#aeb4af] dark:hover:text-[#d09272] ${focusRing}`}
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
                        : "text-[#58635c] hover:text-[#5a1f32] dark:text-[#aeb4af] dark:hover:text-[#d09272]"
                    }`}
                  >
                    <BookmarkIcon filled={post.bookmarked} />
                  </button>
                  </footer>
                    )}
                  </>
                )}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-b border-[#1c2821]/14 px-4 py-14 text-center dark:border-white/10 sm:m-3 sm:border">
          <p className="text-sm font-black">
            {searchQuery
              ? "Aramanla eşleşen bir konu bulunamadı."
              : activeView === "saved"
              ? "Bu filtrede kaydedilmiş bir konu yok."
              : "Bu filtrelerle eşleşen bir konu yok."}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveView("latest");
              setActiveCategory("Tümü");
              setSearchQuery("");
            }}
            className={`mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[#8f3427] underline decoration-[#9a5944]/35 underline-offset-4 dark:text-[#d09272] ${focusRing}`}
          >
            Ana akışa dön
          </button>
        </div>
      )}
    </section>
  );
}

function ComposerAction({
  symbol,
  label,
  className = "",
}: {
  symbol: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href="/konu-olustur"
      aria-label={label}
      title={label}
      className={`size-11 shrink-0 place-items-center text-base font-black text-[#7d3c2d] transition-colors hover:bg-[#5a1f32]/6 hover:text-[#5a1f32] dark:text-[#d09272] dark:hover:bg-[#c7896d]/8 dark:hover:text-[#e0aa8d] ${focusRing} ${className || "grid"}`}
    >
      <span aria-hidden="true">{symbol}</span>
    </Link>
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
