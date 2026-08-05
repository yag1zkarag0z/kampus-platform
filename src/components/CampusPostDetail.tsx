"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusButton } from "@/components/campusButtonStyles";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCommentActions from "@/components/CampusCommentActions";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusHiddenNotice from "@/components/CampusHiddenNotice";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
import CampusPostActions from "@/components/CampusPostActions";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import CampusEmojiPicker from "@/components/CampusEmojiPicker";
import GiphyPicker from "@/components/GiphyPicker";
import { useFeedback } from "@/components/FeedbackProvider";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
import { formatCampusAbsoluteDateTime } from "@/content/adapter";
import {
  commentSortOptions,
  sortCampusComments,
  type CommentSort,
} from "@/content/commentSort";
import {
  isAnonymousCampusAuthor,
  isSameVisibleCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusGif as CampusGifData,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";


export default function CampusPostDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { isGuest } = useCampusAccount();
  const {
    posts,
    isHydrated,
    toggleLike,
    toggleBookmark,
    addComment,
    loadPostDetail,
  } = useCampusData();
  const [commentDraft, setCommentDraft] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedGif, setSelectedGif] = useState<CampusGifData | undefined>();
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  // Kutu tek satır başlar; odaklanınca araçlar açılır.
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("oldest");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrowTextarea(commentInputRef, commentDraft);
  const [hasDetailRequestCompleted, setHasDetailRequestCompleted] =
    useState(false);
  const [isNotificationTarget, setIsNotificationTarget] = useState(false);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(
    null,
  );
  const commentsSectionRef = useRef<HTMLElement>(null);
  const post = posts.find((currentPost) => currentPost.id === postId);
  const comments = post?.comments;

  const sortedComments = comments
    ? sortCampusComments(comments, commentSort)
    : [];

  useEffect(() => {
    if (!isHydrated || isGuest) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setHasDetailRequestCompleted(false);
      }
    });

    void loadPostDetail(postId)
      .catch(() => {
        showToast({
          message: "Gönderi ayrıntıları yüklenemedi.",
          tone: "error",
        });
      })
      .finally(() => {
        if (!isCancelled) {
          setHasDetailRequestCompleted(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    isGuest,
    isHydrated,
    loadPostDetail,
    postId,
    showToast,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const shouldHighlightComments =
      searchParams.get("hedef") === "yorum" ||
      window.location.hash === "#yorumlar";
    const requestedCommentId = searchParams.get("yorum");

    if (!shouldHighlightComments) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      const targetElement = requestedCommentId
        ? document.getElementById(`yorum-${requestedCommentId}`) ??
          commentsSectionRef.current
        : commentsSectionRef.current;

      targetElement?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      setIsNotificationTarget(true);
      setTargetCommentId(requestedCommentId);
    }, 120);
    const highlightTimer = window.setTimeout(() => {
      setIsNotificationTarget(false);
      setTargetCommentId(null);
    }, 2400);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [isHydrated, postId]);

  const appendEmoji = (emoji: string) => {
    setCommentDraft((currentDraft) =>
      currentDraft.length + emoji.length <= 500
        ? `${currentDraft}${emoji}`
        : currentDraft,
    );
    setFormMessage("");
    setIsEmojiPickerOpen(false);
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isGuest) {
      return;
    }

    const body = commentDraft.trim();

    if (!body && !selectedGif) {
      setFormMessage("Yorum yazmalı veya bir GIF seçmelisin.");
      return;
    }

    if (isCommentSubmitting) {
      return;
    }

    setIsCommentSubmitting(true);
    setFormMessage("Yorumun gönderiliyor…");

    try {
      await addComment(postId, {
        body,
        isAnonymous,
        gif: selectedGif,
      });
      setCommentDraft("");
      setSelectedGif(undefined);
      setIsGifPickerOpen(false);
      setIsEmojiPickerOpen(false);
      setFormMessage("");
      // Yorum kutunun hemen altındaki listede beliriyor; toast tekrar olurdu.
    } catch {
      setFormMessage("Yorum gönderilemedi. Tekrar dene.");
      showToast({
        message: "Yorum gönderilemedi.",
        tone: "error",
      });
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const commentsTitleId = `post-comments-${postId}`;
  const commentIdentityId = `post-comment-identity-${postId}`;

  if (!post) {
    return isHydrated &&
      (isGuest || hasDetailRequestCompleted) ? (
      <MissingPost />
    ) : (
      <PostDetailLoading />
    );
  }

  return (
    <section className="min-h-full min-w-0 bg-[#0a0d16] text-white">
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        {/* X'teki gibi sola yaslı: geri oku ve başlık yan yana. */}
        <div className="flex min-h-16 items-center gap-4 px-3 sm:px-5">
          <Link
            href="/akis"
            aria-label="Kampüs akışına dön"
            className={`grid size-11 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-[-0.03em]">
              Gönderi
            </h1>
            <p className="truncate text-xs font-semibold text-white/55">
              {post.category}
            </p>
          </div>
        </div>
      </header>

      <article className="border-b border-white/10 px-4 py-6 sm:px-6 sm:py-7">
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
            {/* X'teki gibi: ad üstte, kullanıcı adı altında; kategori
                rozetinin yeri gövdenin hemen üstü. */}
            <div className="min-w-0 pt-0.5">
              <CampusAuthorProfileLink
                author={post.author}
                authorId={post.authorId}
                isAnonymous={post.isAnonymous}
                ariaLabel={`${post.author} profilini aç`}
                className="min-w-0"
                linkClassName={`block truncate text-base font-black transition-colors hover:text-[#ff7a45] ${focusRing}`}
              >
                <span className="block truncate text-base font-black">
                  {post.author}
                </span>
              </CampusAuthorProfileLink>

              {!isAnonymousCampusAuthor(post) && post.detail && (
                <p className="mt-0.5 truncate text-sm text-white/50">
                  {post.detail}
                </p>
              )}

              <span
                className={`mt-2 ${campusCategoryBadgeBase} ${campusCategoryStyles[post.category].badge}`}
              >
                <span aria-hidden="true">
                  {campusCategoryStyles[post.category].glyph}
                </span>
                {post.category}
              </span>
            </div>
          </div>
          <div className="-mr-2 flex shrink-0 items-center gap-0.5">
            <CampusPostActions
              post={post}
              redirectAfterBlock
              redirectAfterDelete
            />
          </div>
        </header>

        {post.isDeleted ? (
          <div className="mt-5 border border-dashed border-white/12 bg-white/[0.025] px-4 py-5">
            <p className="text-sm font-black">Bu gönderi kaldırıldı.</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Yorumların sırası ve konuşma bağlamı korunmaya devam ediyor.
            </p>
          </div>
        ) : (
          <>
            {post.title && (
              <h1 className="mt-5 max-w-[78ch] break-words text-3xl font-black leading-[1.12] tracking-[-0.04em] sm:text-4xl sm:leading-[1.08]">
                {post.title}
              </h1>
            )}

            {post.isHidden && <CampusHiddenNotice />}

            {post.listing && (
              <CampusListingMeta listing={post.listing} variant="detail" />
            )}

            {post.body && (
              <p className="mt-4 max-w-[78ch] whitespace-pre-wrap break-words text-base leading-8 tracking-[-0.01em] text-white/85 sm:text-lg sm:leading-8">
                {post.body}
              </p>
            )}

            {post.image && (
              <CampusPostImage image={post.image} variant="detail" />
            )}
            {post.gif && <CampusGif gif={post.gif} />}
            {post.poll && (
              <CampusPoll postId={post.id} poll={post.poll} />
            )}

            {/* Detayda göreli değil mutlak zaman: gönderiyi açan kişi tam
                olarak ne zaman paylaşıldığını görmek ister. */}
            <p className="mt-4 text-sm text-white/50">
              <time dateTime={new Date(post.createdAt).toISOString()}>
                {formatCampusAbsoluteDateTime(post.createdAt)}
              </time>
              {post.edited && !post.isDeleted ? " · düzenlendi" : ""}
              {post.isHidden ? " · inceleme altında" : ""}
            </p>

            <footer className="mt-4 border-t border-white/8 pt-3">
          {isGuest ? (
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 px-2 text-xs font-bold text-white/55">
                <HeartIcon filled={false} />
                {post.likes} beğeni
              </span>
              <Link
                href="/giris"
                className={`inline-flex min-h-11 items-center px-3 text-xs font-black text-[#ff7a45] transition-colors hover:text-[#ff7a45]/80 ${focusRing}`}
              >
                Etkileşim için giriş yap
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-pressed={post.liked}
                aria-label={
                  post.liked
                    ? `Beğeniyi kaldır, ${post.likes} beğeni`
                    : `Gönderiyi beğen, ${post.likes} beğeni`
                }
                onClick={() => toggleLike(post.id)}
                className={`campus-pop-on-active inline-flex min-h-12 items-center gap-2.5 px-3 text-base font-bold transition-colors ${focusRing} ${
                  post.liked
                    ? "text-[#df8b83]"
                    : "text-white/54 hover:text-[#df8b83]"
                }`}
              >
                <HeartIcon filled={post.liked} />
                <span aria-live="polite" aria-atomic="true">
                  {post.likes}
                </span>
                <span>beğeni</span>
              </button>

              {/* Ayrı sayfada, dikkat dağılmadan yorum yazmak için. */}
              <Link
                href={`/gonderi/${post.id}/yorum-yaz`}
                aria-label={`Yorum yaz, ${post.commentCount ?? post.comments.length} yorum`}
                className={`campus-pop-on-active inline-flex min-h-12 items-center gap-2.5 px-3 text-base font-bold text-white/54 transition-colors hover:text-[#ff7a45] ${focusRing}`}
              >
                <CommentIcon />
                <span>{post.commentCount ?? post.comments.length}</span>
                <span className="hidden min-[380px]:inline">yorum</span>
              </Link>

              <button
                type="button"
                aria-pressed={post.bookmarked}
                aria-label={
                  post.bookmarked
                    ? "Kaydedilenlerden çıkar"
                    : "Gönderiyi kaydet"
                }
                onClick={() => toggleBookmark(post.id)}
                className={`campus-pop-on-active grid size-12 shrink-0 place-items-center rounded-full transition-colors ${focusRing} ${
                  post.bookmarked
                    ? "text-[#ff7a45]"
                    : "text-white/48 hover:bg-white/6 hover:text-[#ff7a45]"
                }`}
              >
                <BookmarkIcon filled={post.bookmarked} />
              </button>
            </div>
          )}
            </footer>
          </>
        )}
      </article>

      <section
        ref={commentsSectionRef}
        id="yorumlar"
        aria-labelledby={commentsTitleId}
        className={`scroll-mt-44 px-4 pt-2 pb-8 transition-[background-color,box-shadow] duration-700 motion-reduce:duration-0 sm:px-6 sm:pt-3 md:scroll-mt-28 ${
          isNotificationTarget
            ? "bg-[#ff7a45]/8 shadow-[inset_4px_0_0_#ff7a45]"
            : ""
        }`}
      >
        {/* Başlık görsel olarak gereksiz; ekran okuyucu için duruyor. */}
        <h2 id={commentsTitleId} className="sr-only">
          Yorumlar
        </h2>

        {post.isDeleted ? (
          <div className="border-b border-white/8 py-5">
            <p className="text-sm font-black">
              Kaldırılmış gönderilere yeni yorum eklenemez.
            </p>
          </div>
        ) : isGuest ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 py-5">
            <div>
              <p className="text-sm font-black">Yorum yapmak için giriş yap.</p>
              <p className="mt-1 text-xs text-white/55">
                Misafirler gönderileri yalnızca görüntüleyebilir.
              </p>
            </div>
            <Link
              href="/giris"
              className={`${campusButton.primary} `}
            >
              Giriş yap
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submitComment}
            className="border-b border-white/8 py-5"
          >
            {/* Solda profil, sağda yalnızca yazı alanı; çerçeve yok. */}
            <div className="flex items-start gap-3">
              <CampusAuthorAvatar
                author={isAnonymous ? "Anonim" : "@sen"}
                authorId={LOCAL_ACCOUNT_OWNER_ID}
                isAnonymous={isAnonymous}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`post-comment-input-${post.id}`}
                  className="sr-only"
                >
                  Yorumunu ekle
                </label>
                <p id={commentIdentityId} className="sr-only">
                  {isAnonymous
                    ? "Diğer öğrenciler seni anonim görecek."
                    : "Profilinle görünecek."}
                </p>
                <textarea
                  ref={commentInputRef}
                  onFocus={() => setIsReplyExpanded(true)}
                  id={`post-comment-input-${post.id}`}
                  value={commentDraft}
                  onChange={(event) => {
                    setCommentDraft(event.target.value);
                    setFormMessage("");
                  }}
                  maxLength={500}
                  rows={1}
                  placeholder="Ne düşünüyorsun?"
                  aria-describedby={`${commentIdentityId} post-comment-help-${post.id}`}
                  /* Akıştaki konu alanıyla aynı dil: çerçevesiz, saydam, iri yazı. */
                  className="min-h-12 w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-lg font-semibold leading-7 text-white outline-none ring-0 placeholder:font-medium placeholder:text-white/42 focus:outline-none focus:ring-0 focus-visible:ring-0 sm:text-xl"
                />
              </div>

              {/* Kapalıyken buton satırın sağında durur. */}
              {!isReplyExpanded && (
                <button
                  type="submit"
                  disabled={
                    (!commentDraft.trim() && !selectedGif) ||
                    isCommentSubmitting
                  }
                  className={`shrink-0 self-center ${campusButton.primary}`}
                >
                  Yorum yap
                </button>
              )}
            </div>

            {selectedGif && (
              <div className="relative">
                <CampusGif gif={selectedGif} compact />
                <button
                  type="button"
                  onClick={() => setSelectedGif(undefined)}
                  aria-label="Seçilen GIF'i kaldır"
                  className={`absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/75 text-sm font-black text-white hover:bg-black ${focusRing}`}
                >
                  ×
                </button>
              </div>
            )}

            <div
              className={`mt-3 flex-wrap items-center justify-between gap-3 ${
                isReplyExpanded ? "flex" : "hidden"
              }`}
            >
              <div className="flex items-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-white/12 px-3 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                    className="size-4 accent-[#ff7a45]"
                  />
                  Anonim
                </label>

                <div className="relative">
                  <button
                    type="button"
                    aria-label="Yoruma emoji ekle"
                    aria-expanded={isEmojiPickerOpen}
                    onClick={() =>
                      setIsEmojiPickerOpen((currentValue) => !currentValue)
                    }
                    className={`grid size-11 place-items-center border border-white/12 text-lg transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                  >
                    <span aria-hidden="true">☺</span>
                  </button>

                  {isEmojiPickerOpen && (
                    <CampusEmojiPicker onSelect={appendEmoji} />
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Yoruma GIF ekle"
                    onClick={() => setIsGifPickerOpen((value) => !value)}
                    aria-expanded={isGifPickerOpen}
                    className={`grid size-11 place-items-center border border-white/12 text-[10px] font-black text-[#ff7a45] transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                  >
                    GIF
                  </button>
                  {isGifPickerOpen && (
                    <GiphyPicker
                      onClose={() => setIsGifPickerOpen(false)}
                      onSelect={(gif) => {
                        setSelectedGif(gif);
                        setIsGifPickerOpen(false);
                      }}
                    />
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  (!commentDraft.trim() && !selectedGif) || isCommentSubmitting
                }
                className={`${campusButton.primary} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                Yorum yap
              </button>
            </div>

            <div
              id={`post-comment-help-${post.id}`}
              className="mt-2 flex min-h-5 items-center justify-between gap-3 text-[11px] font-medium"
            >
              <p
                role="status"
                aria-live="polite"
                className={
                  formMessage === "Yorumun eklendi."
                    ? "text-[#9fc5a3]"
                    : "text-[#ffb199]"
                }
              >
                {formMessage}
              </p>
              <span className="ml-auto shrink-0 font-mono text-white/42">
                {commentDraft.length}/500
              </span>
            </div>
          </form>
        )}

        {/* Sıralama yalnızca görünümü değiştirir; hiçbir yorumu gizlemez. */}
        <div
          role="group"
          aria-label="Yorum sıralaması"
          className="flex flex-wrap items-center gap-1 border-b border-white/8 py-3"
        >
          {commentSortOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={commentSort === option.id}
              onClick={() => setCommentSort(option.id)}
              className={`min-h-11 cursor-pointer rounded-full px-3.5 text-sm font-black transition-colors ${focusRing} ${
                commentSort === option.id
                  ? "bg-[#ff7a45]/14 text-[#ff7a45]"
                  : "text-white/55 hover:bg-white/6 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {sortedComments.length > 0 ? (
          <ol className="divide-y divide-white/8">
            {sortedComments.map((comment) => {
              const parentComment = comment.parentId
                ? sortedComments.find(
                    (candidate) => candidate.id === comment.parentId,
                  )
                : undefined;

              return (
              <li
                key={comment.id}
                id={`yorum-${comment.id}`}
                className="scroll-mt-40"
              >
                <article
                  className={`relative flex items-start gap-3 py-5 transition-colors sm:py-6 ${
                    comment.isDeleted ? "" : "hover:bg-white/[0.035]"
                  } ${
                    comment.parentId
                      ? "ml-7 border-l-2 border-[#ff7a45]/18 pl-3 sm:ml-12 sm:pl-4"
                      : ""
                  } ${
                    targetCommentId === comment.id
                      ? "bg-[#ff7a45]/8 shadow-[inset_3px_0_0_#ff7a45]"
                      : ""
                  }`}
                >
                  {/* Kartın tamamı tıklanabilir olsun diye kaplama bağlantı:
                      GIF'li ve metinsiz yorumlar da yorum sayfasını açar.
                      İç kontroller aşağıda z-10 ile üste alınıyor. */}
                  {!comment.isDeleted && (
                    <Link
                      href={`/gonderi/${post.id}/yorum/${comment.id}`}
                      aria-label={`${comment.author} yorumunu aç`}
                      className={`absolute inset-0 ${focusRing}`}
                    />
                  )}
                  <CampusAuthorProfileLink
                    author={comment.author}
                    authorId={comment.authorId}
                    isAnonymous={comment.isAnonymous}
                    ariaLabel={`${comment.author} profilini aç`}
                    className="relative z-10 shrink-0"
                    linkClassName={`rounded-full transition-opacity hover:opacity-80 ${focusRing}`}
                  >
                    <CampusAuthorAvatar
                      author={comment.author}
                      authorId={comment.authorId}
                      isAnonymous={comment.isAnonymous}
                      size="sm"
                    />
                  </CampusAuthorProfileLink>
                  <div className="min-w-0 flex-1">
                    <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CampusAuthorProfileLink
                        author={comment.author}
                        authorId={comment.authorId}
                        isAnonymous={comment.isAnonymous}
                        ariaLabel={`${comment.author} profilini aç`}
                        className="relative z-10"
                        linkClassName={`text-[15px] font-black transition-colors hover:text-[#ff7a45] ${focusRing}`}
                      >
                        <span className="text-xs font-black">
                          {comment.author}
                        </span>
                      </CampusAuthorProfileLink>
                      <span
                        aria-hidden="true"
                        className="size-1 rounded-full bg-white/24"
                      />
                      {/* Göreli değil tam zaman: yorumun ne zaman yazıldığı
                          gönderi detayında da net görünsün. */}
                      <time
                        dateTime={
                          comment.createdAt === undefined
                            ? undefined
                            : new Date(comment.createdAt).toISOString()
                        }
                        className="text-sm text-white/50"
                      >
                        {comment.createdAt === undefined
                          ? comment.time
                          : formatCampusAbsoluteDateTime(comment.createdAt)}
                        {comment.edited && !comment.isDeleted
                          ? " · düzenlendi"
                          : ""}
                      </time>
                      {isSameVisibleCampusAuthor(post, comment) && (
                        <span className="border border-[#ff7a45]/25 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#ff7a45]">
                          Gönderi sahibi
                        </span>
                      )}
                    </header>
                    {parentComment && (
                      <p className="mt-1 text-[11px] font-bold text-[#ff7a45]">
                        {parentComment.isDeleted ? (
                          "Kaldırılmış yoruma yanıt"
                        ) : (
                          <>
                            <CampusAuthorProfileLink
                              author={parentComment.author}
                              authorId={parentComment.authorId}
                              isAnonymous={parentComment.isAnonymous}
                              ariaLabel={`${parentComment.author} profilini aç`}
                              className="relative z-10"
                              linkClassName={`transition-colors hover:text-[#ff7a45] ${focusRing}`}
                            >
                              <span>{parentComment.author}</span>
                            </CampusAuthorProfileLink>{" "}
                            kullanıcısına yanıt
                          </>
                        )}
                      </p>
                    )}
                    {comment.isDeleted ? (
                      <div className="mt-2 border border-dashed border-white/11 bg-white/[0.02] px-3 py-3">
                        <p className="text-xs font-bold text-white/55">
                          Bu yorum kaldırıldı.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Bağlantı değil: satırın tamamını kaplayan
                            bağlantı yukarıda, iç içe bağlantı geçersiz olurdu. */}
                        {comment.body && (
                          <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-base leading-7 tracking-[-0.01em] text-white/78 sm:leading-8">
                            {comment.body}
                          </p>
                        )}
                        {comment.gif && <CampusGif gif={comment.gif} compact />}
                        {/* Yanıt, sayfayı yukarı kaydırmak yerine yorumun
                            kendi sayfasında yazılır. */}
                        <div className="relative z-10">
                          <CampusCommentActions
                            postId={post.id}
                            comment={comment}
                            onReply={() =>
                              router.push(
                                `/gonderi/${post.id}/yorum/${comment.id}`,
                              )
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                </article>
              </li>
              );
            })}
          </ol>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-black">Henüz yorum yok.</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              {isGuest
                ? "Yorum yapmak için üye girişi gerekir."
                : "Bu konuya ilk yanıtı sen bırak."}
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

function PostDetailLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Gönderi yükleniyor"
      className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#0a0d16] px-5 md:min-h-svh"
    >
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff7a45] motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-bold text-white/60">
          Gönderi yükleniyor…
        </p>
      </div>
    </section>
  );
}

function MissingPost() {
  return (
    <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#0a0d16] px-5 py-16 text-center md:min-h-svh">
      <div className="max-w-md">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
          Gönderi bulunamadı
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em]">
          Bu konu artık burada değil.
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Gönderi kaldırılmış veya tarayıcı verileri temizlenmiş olabilir.
        </p>
        <Link
          href="/akis"
          className={`mt-7 ${campusButton.primary} `}
        >
          Akışa dön
        </Link>
      </div>
    </section>
  );
}

function CommentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className="size-6"
    >
      <path d="M16.3 9.1c0 3.4-2.8 6-6.3 6a7 7 0 0 1-2.3-.4L4 16l1.1-3A5.8 5.8 0 0 1 3.7 9.1c0-3.4 2.8-6.1 6.3-6.1s6.3 2.7 6.3 6.1Z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-5"
    >
      <path
        d="m12.5 4.5-5.5 5.5 5.5 5.5M7.4 10h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      className="size-6"
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
