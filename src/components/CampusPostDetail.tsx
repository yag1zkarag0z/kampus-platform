"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCommentActions from "@/components/CampusCommentActions";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostActions from "@/components/CampusPostActions";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import GiphyPicker from "@/components/GiphyPicker";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  isAnonymousCampusAuthor,
  isSameVisibleCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusGif as CampusGifData,
} from "@/data/campusPosts";

const quickEmojis = [
  { value: "👍", label: "Beğeni" },
  { value: "❤️", label: "Kalp" },
  { value: "😂", label: "Kahkaha" },
  { value: "🥲", label: "Duygulu yüz" },
  { value: "🎉", label: "Kutlama" },
  { value: "📚", label: "Kitaplar" },
  { value: "📍", label: "Konum" },
  { value: "❓", label: "Soru" },
  { value: "💀", label: "Kuru kafa" },
  { value: "🗿", label: "Moai" },
  { value: "🤡", label: "Palyaço" },
  { value: "🤨", label: "Şüpheli yüz" },
  { value: "😭", label: "Ağlayan yüz" },
  { value: "🫡", label: "Selam veren yüz" },
  { value: "🔥", label: "Ateş" },
  { value: "👀", label: "Gözler" },
] as const;

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";

export default function CampusPostDetail({ postId }: { postId: string }) {
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
  const [isCommentSubmitting, setIsCommentSubmitting] =
    useState(false);
  const [hasDetailRequestCompleted, setHasDetailRequestCompleted] =
    useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [isNotificationTarget, setIsNotificationTarget] = useState(false);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(
    null,
  );
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentsSectionRef = useRef<HTMLElement>(null);
  const post = posts.find((currentPost) => currentPost.id === postId);
  const replyTarget = post?.comments.find(
    (comment) => comment.id === replyTargetId && !comment.isDeleted,
  );

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
        : currentDraft
    );
    setFormMessage("");
    setIsEmojiPickerOpen(false);
  };

  const submitComment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isGuest) {
      return;
    }

    const body = commentDraft.trim();

    if (!body) {
      setFormMessage("Yorumunu yazmadan gönderemezsin.");
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
        parentId: replyTarget?.id,
        gif: selectedGif,
      });
      setCommentDraft("");
      setSelectedGif(undefined);
      setIsGifPickerOpen(false);
      setReplyTargetId(null);
      setIsEmojiPickerOpen(false);
      setFormMessage("");
      showToast({
        message: "Yorumun gönderiye eklendi.",
        tone: "success",
      });
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
      <header className="sticky top-16 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-5">
          <Link
            href="/akis"
            aria-label="Kampüs akışına dön"
            className={`grid size-11 shrink-0 place-items-center justify-self-start rounded-full text-white/65 transition-colors hover:bg-white/7 hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>

          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
              Gönderi
            </p>
            <p className="truncate text-sm font-black tracking-[-0.02em]">
              {post.category}
            </p>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <article className="border-b border-white/10 px-4 py-6 sm:m-3 sm:border sm:bg-white/[0.015] sm:px-6 sm:py-7">
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
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff7a45]">
                  {post.category}
                </span>
                <span
                  aria-hidden="true"
                  className="size-1 rotate-45 bg-[#ff7a45]/60"
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
              </div>
              {!isAnonymousCampusAuthor(post) &&
                post.detail && (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-white/55">
                    {post.detail}
                  </p>
                )}
            </div>
          </div>
          <div className="-mr-2 flex shrink-0 items-center gap-0.5">
            <time className="text-[11px] font-semibold text-white/55">
              {post.time}
              {post.edited && !post.isDeleted ? " · düzenlendi" : ""}
            </time>
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
              <h1 className="mt-5 max-w-[78ch] break-words text-[1.65rem] font-black leading-[1.12] tracking-[-0.04em] sm:text-3xl sm:leading-[1.1]">
                {post.title}
              </h1>
            )}

            {post.listing && (
              <CampusListingMeta listing={post.listing} variant="detail" />
            )}

            {post.body && (
              <p className="mt-4 max-w-[78ch] whitespace-pre-wrap break-words text-[15px] leading-7 tracking-[-0.01em] text-white/80 sm:text-base sm:leading-7">
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

            <footer className="mt-6 border-t border-white/8 pt-3">
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
                className={`inline-flex min-h-11 items-center gap-2 px-2 text-xs font-bold transition-colors ${focusRing} ${
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

              <button
                type="button"
                aria-pressed={post.bookmarked}
                aria-label={
                  post.bookmarked
                    ? "Kaydedilenlerden çıkar"
                    : "Gönderiyi kaydet"
                }
                onClick={() => toggleBookmark(post.id)}
                className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${focusRing} ${
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
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-white/8">
          <h2
            id={commentsTitleId}
            className="text-base font-black tracking-[-0.025em]"
          >
            Yorumlar
          </h2>
          <span className="font-mono text-[11px] font-bold text-white/55">
            {post.comments.length}
          </span>
        </div>

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
              className={`inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
            >
              Giriş yap
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submitComment}
            className="border-b border-white/8 py-5"
          >
          {replyTarget && (
            <div className="mb-3 flex min-h-11 items-center justify-between gap-3 border-l-2 border-[#ff7a45] bg-[#ff7a45]/8 px-3 text-xs">
              <p className="min-w-0 truncate">
                <CampusAuthorProfileLink
                  author={replyTarget.author}
                  authorId={replyTarget.authorId}
                  isAnonymous={replyTarget.isAnonymous}
                  ariaLabel={`${replyTarget.author} profilini aç`}
                  linkClassName={`font-black transition-colors hover:text-[#ff7a45] ${focusRing}`}
                >
                  <span className="font-black">{replyTarget.author}</span>
                </CampusAuthorProfileLink>{" "}
                kullanıcısına yanıt yazıyorsun.
              </p>
              <button
                type="button"
                onClick={() => setReplyTargetId(null)}
                className={`min-h-10 shrink-0 cursor-pointer px-2 font-black text-[#ff7a45] ${focusRing}`}
              >
                Vazgeç
              </button>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <CampusAuthorAvatar
              author={isAnonymous ? "Anonim" : "@sen"}
              authorId={LOCAL_ACCOUNT_OWNER_ID}
              isAnonymous={isAnonymous}
              size="sm"
            />
            <div>
              <label
                htmlFor={`post-comment-input-${post.id}`}
                className="text-sm font-black tracking-[-0.015em]"
              >
                Yorumunu ekle
              </label>
              <p
                id={commentIdentityId}
                className="mt-0.5 text-[11px] font-semibold text-white/55"
              >
                {isAnonymous
                  ? "Diğer öğrenciler seni anonim görecek."
                  : "Profilinle görünecek."}
              </p>
            </div>
          </div>
          <textarea
            ref={commentInputRef}
            id={`post-comment-input-${post.id}`}
            value={commentDraft}
            onChange={(event) => {
              setCommentDraft(event.target.value);
              setFormMessage("");
            }}
            maxLength={500}
            rows={4}
            placeholder="Ne düşünüyorsun?"
            aria-describedby={`${commentIdentityId} post-comment-help-${post.id}`}
            className={`mt-3 min-h-28 w-full resize-y border border-white/12 bg-white/[0.02] px-3.5 py-3 text-sm leading-6 placeholder:text-white/45 ${focusRing}`}
          />

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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-white/12 px-3 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  className="size-4 accent-[#ff7a45]"
                />
                Anonim yorumla
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
                  <EmojiPicker onSelect={appendEmoji} />
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsGifPickerOpen((value) => !value)}
                  aria-expanded={isGifPickerOpen}
                  className={`grid size-11 place-items-center border border-white/12 text-[10px] font-black text-[#ff7a45] transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                >
                  GIF
                </button>
                {isGifPickerOpen && (
                  <GiphyPicker
                    onClose={() => setIsGifPickerOpen(false)}
                    onSelect={(gif) => { setSelectedGif(gif); setIsGifPickerOpen(false); }}
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !commentDraft.trim() || isCommentSubmitting
              }
              className={`inline-flex min-h-11 items-center justify-center bg-white px-5 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
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

        {post.comments.length > 0 ? (
          <ol className="divide-y divide-white/8">
            {post.comments.map((comment) => {
              const parentComment = comment.parentId
                ? post.comments.find(
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
                  className={`flex items-start gap-3 py-5 sm:py-6 ${
                    comment.parentId
                      ? "ml-7 border-l-2 border-[#ff7a45]/18 pl-3 sm:ml-12 sm:pl-4"
                      : ""
                  } ${
                    targetCommentId === comment.id
                      ? "bg-[#ff7a45]/8 shadow-[inset_3px_0_0_#ff7a45]"
                      : ""
                  }`}
                >
                  <CampusAuthorProfileLink
                    author={comment.author}
                    authorId={comment.authorId}
                    isAnonymous={comment.isAnonymous}
                    ariaLabel={`${comment.author} profilini aç`}
                    className="shrink-0"
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
                        linkClassName={`text-xs font-black transition-colors hover:text-[#ff7a45] ${focusRing}`}
                      >
                        <span className="text-xs font-black">
                          {comment.author}
                        </span>
                      </CampusAuthorProfileLink>
                      <span
                        aria-hidden="true"
                        className="size-1 rounded-full bg-white/24"
                      />
                      <time className="text-[11px] font-semibold text-white/55">
                        {comment.time}
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
                        <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-sm leading-6 text-white/78 sm:text-[15px] sm:leading-7">
                          {comment.body}
                        </p>
                        {comment.gif && <CampusGif gif={comment.gif} compact />}
                        <CampusCommentActions
                          postId={post.id}
                          comment={comment}
                          onReply={() => {
                            setReplyTargetId(comment.id);
                            window.setTimeout(() => {
                              commentInputRef.current?.focus();
                              commentInputRef.current?.scrollIntoView({
                                behavior: window.matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches
                                  ? "auto"
                                  : "smooth",
                                block: "center",
                              });
                            }, 0);
                          }}
                        />
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
          className={`mt-7 inline-flex min-h-11 items-center justify-center bg-white px-5 text-sm font-bold text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
        >
          Akışa dön
        </Link>
      </div>
    </section>
  );
}

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Yorum emojileri"
      className="absolute right-0 bottom-[calc(100%+0.5rem)] z-40 grid w-48 grid-cols-4 gap-1 border border-white/12 bg-[#17191c] p-2 shadow-[0_16px_42px_rgba(0,0,0,0.4)] sm:right-auto sm:left-0"
    >
      {quickEmojis.map((emoji) => (
        <button
          key={emoji.value}
          type="button"
          aria-label={`${emoji.label} emojisini ekle`}
          onClick={() => onSelect(emoji.value)}
          className={`grid size-10 place-items-center rounded-lg text-xl transition-colors hover:bg-[#ff7a45]/10 ${focusRing}`}
        >
          <span aria-hidden="true">{emoji.value}</span>
        </button>
      ))}
    </div>
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
