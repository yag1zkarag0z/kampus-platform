"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostImage from "@/components/CampusPostImage";
import {
  isAnonymousCampusAuthor,
  isSameVisibleCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
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
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:focus-visible:ring-[#c7896d]/30";

export default function CampusPostDetail({ postId }: { postId: string }) {
  const {
    posts,
    isHydrated,
    toggleLike,
    toggleBookmark,
    addComment,
  } = useCampusData();
  const [commentDraft, setCommentDraft] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const post = posts.find((currentPost) => currentPost.id === postId);

  const appendEmoji = (emoji: string) => {
    setCommentDraft((currentDraft) =>
      currentDraft.length + emoji.length <= 500
        ? `${currentDraft}${emoji}`
        : currentDraft
    );
    setFormMessage("");
    setIsEmojiPickerOpen(false);
  };

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = commentDraft.trim();

    if (!body) {
      setFormMessage("Yorumunu yazmadan gönderemezsin.");
      return;
    }

    addComment(postId, {
      body,
      isAnonymous,
    });
    setCommentDraft("");
    setIsEmojiPickerOpen(false);
    setFormMessage("Yorumun eklendi.");
  };

  const commentsTitleId = `post-comments-${postId}`;
  const commentIdentityId = `post-comment-identity-${postId}`;

  if (!post) {
    return isHydrated ? <MissingPost /> : <PostDetailLoading />;
  }

  return (
    <section className="min-h-full min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1]">
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/14 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-5">
          <Link
            href="/akis"
            aria-label="Kampüs akışına dön"
            className={`grid size-11 shrink-0 place-items-center justify-self-start rounded-full text-[#1c2821]/70 transition-colors hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-white/65 dark:hover:bg-white/7 dark:hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>

          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f3427] dark:text-[#c7896d]">
              Gönderi
            </p>
            <p className="truncate text-sm font-black tracking-[-0.02em]">
              {post.category}
            </p>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <article className="border-b border-[#1c2821]/14 px-4 py-6 dark:border-white/10 sm:m-3 sm:border sm:bg-white/20 sm:px-6 sm:py-7 dark:sm:bg-white/[0.015]">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <CampusAuthorAvatar
              author={post.author}
              authorId={post.authorId}
              isAnonymous={post.isAnonymous}
            />
            <div className="min-w-0 pt-0.5">
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
              {!isAnonymousCampusAuthor(post) &&
                post.detail && (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1c2821]/52 dark:text-white/48">
                    {post.detail}
                  </p>
                )}
            </div>
          </div>
          <time className="shrink-0 text-[11px] font-semibold text-[#1c2821]/52 dark:text-white/48">
            {post.time}
          </time>
        </header>

        <h1 className="mt-5 max-w-[78ch] text-[1.65rem] font-black leading-[1.12] tracking-[-0.04em] sm:text-3xl sm:leading-[1.1]">
          {post.title}
        </h1>

        {post.listing && (
          <CampusListingMeta listing={post.listing} variant="detail" />
        )}

        {post.body && (
          <p className="mt-4 max-w-[78ch] whitespace-pre-wrap text-[15px] leading-7 tracking-[-0.01em] text-[#1c2821]/82 dark:text-white/80 sm:text-base sm:leading-7">
            {post.body}
          </p>
        )}

        {post.image && (
          <CampusPostImage image={post.image} variant="detail" />
        )}
        {post.poll && (
          <CampusPoll postId={post.id} poll={post.poll} />
        )}

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-[#1c2821]/10 pt-3 dark:border-white/8">
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
                ? "text-[#8f2336] dark:text-[#df8b83]"
                : "text-[#1c2821]/58 hover:text-[#8f2336] dark:text-white/54 dark:hover:text-[#df8b83]"
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
              post.bookmarked ? "Kaydedilenlerden çıkar" : "Gönderiyi kaydet"
            }
            onClick={() => toggleBookmark(post.id)}
            className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${focusRing} ${
              post.bookmarked
                ? "text-[#5a1f32] dark:text-[#d09272]"
                : "text-[#1c2821]/50 hover:bg-[#1c2821]/5 hover:text-[#5a1f32] dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-[#d09272]"
            }`}
          >
            <BookmarkIcon filled={post.bookmarked} />
          </button>
        </footer>
      </article>

      <section
        id="yorumlar"
        aria-labelledby={commentsTitleId}
        className="scroll-mt-44 px-4 pt-2 pb-8 sm:px-6 sm:pt-3 md:scroll-mt-28"
      >
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[#1c2821]/10 dark:border-white/8">
          <h2
            id={commentsTitleId}
            className="text-base font-black tracking-[-0.025em]"
          >
            Yorumlar
          </h2>
          <span className="font-mono text-[11px] font-bold text-[#1c2821]/48 dark:text-white/44">
            {post.comments.length}
          </span>
        </div>

        <form
          onSubmit={submitComment}
          className="border-b border-[#1c2821]/10 py-5 dark:border-white/8"
        >
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
                className="mt-0.5 text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]"
              >
                {isAnonymous
                  ? "Diğer öğrenciler seni anonim görecek."
                  : "Profilinle görünecek."}
              </p>
            </div>
          </div>
          <textarea
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
            className={`mt-3 min-h-28 w-full resize-y border border-[#1c2821]/14 bg-white/25 px-3.5 py-3 text-sm leading-6 placeholder:text-[#1c2821]/38 dark:border-white/12 dark:bg-white/[0.02] dark:placeholder:text-white/32 ${focusRing}`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-[#1c2821]/14 px-3 text-xs font-bold dark:border-white/12">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  className="size-4 accent-[#5a1f32] dark:accent-[#c7896d]"
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
                  className={`grid size-11 place-items-center border border-[#1c2821]/14 text-lg transition-colors hover:border-[#5a1f32]/35 hover:bg-[#5a1f32]/6 dark:border-white/12 dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/8 ${focusRing}`}
                >
                  <span aria-hidden="true">☺</span>
                </button>

                {isEmojiPickerOpen && (
                  <EmojiPicker onSelect={appendEmoji} />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!commentDraft.trim()}
              className={`inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-5 text-xs font-bold text-white transition-colors hover:bg-[#6b2940] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
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
                  ? "text-[#416649] dark:text-[#9fc5a3]"
                  : "text-[#8a2e25] dark:text-[#e0a083]"
              }
            >
              {formMessage}
            </p>
            <span className="ml-auto shrink-0 font-mono text-[#1c2821]/45 dark:text-white/42">
              {commentDraft.length}/500
            </span>
          </div>
        </form>

        {post.comments.length > 0 ? (
          <ol className="divide-y divide-[#1c2821]/10 dark:divide-white/8">
            {post.comments.map((comment) => (
              <li key={comment.id}>
                <article className="flex items-start gap-3 py-5 sm:py-6">
                  <CampusAuthorAvatar
                    author={comment.author}
                    authorId={comment.authorId}
                    isAnonymous={comment.isAnonymous}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-black">
                        {comment.author}
                      </span>
                      <span
                        aria-hidden="true"
                        className="size-1 rounded-full bg-[#1c2821]/25 dark:bg-white/24"
                      />
                      <time className="text-[11px] font-semibold text-[#1c2821]/52 dark:text-white/48">
                        {comment.time}
                      </time>
                      {isSameVisibleCampusAuthor(post, comment) && (
                        <span className="border border-[#9a5944]/25 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#8f3427] dark:border-[#c7896d]/25 dark:text-[#d09272]">
                          Gönderi sahibi
                        </span>
                      )}
                    </header>
                    <p className="mt-2 max-w-[78ch] whitespace-pre-wrap text-sm leading-6 text-[#1c2821]/80 dark:text-white/78 sm:text-[15px] sm:leading-7">
                      {comment.body}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-black">Henüz yorum yok.</p>
            <p className="mt-1 text-xs leading-5 text-[#1c2821]/55 dark:text-white/50">
              Bu konuya ilk yanıtı sen bırak.
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
      className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#fbf8f1] px-5 dark:bg-[#17191c] md:min-h-svh"
    >
      <div className="text-center">
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-[#1c2821]/15 border-t-[#8f3427] dark:border-white/14 dark:border-t-[#c7896d]"
        />
        <p className="mt-4 text-sm font-bold text-[#1c2821]/62 dark:text-white/60">
          Gönderi yükleniyor…
        </p>
      </div>
    </section>
  );
}

function MissingPost() {
  return (
    <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#fbf8f1] px-5 py-16 text-center dark:bg-[#17191c] md:min-h-svh">
      <div className="max-w-md">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
          Gönderi bulunamadı
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em]">
          Bu konu artık burada değil.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#1c2821]/62 dark:text-white/58">
          Gönderi kaldırılmış veya tarayıcı verileri temizlenmiş olabilir.
        </p>
        <Link
          href="/akis"
          className={`mt-7 inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-5 text-sm font-bold text-white transition-colors hover:bg-[#6b2940] dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
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
      className="absolute right-0 bottom-[calc(100%+0.5rem)] z-40 grid w-48 grid-cols-4 gap-1 border border-[#1c2821]/14 bg-[#fffaf4] p-2 shadow-[0_16px_42px_rgba(28,40,33,0.16)] dark:border-white/12 dark:bg-[#202226] dark:shadow-[0_16px_42px_rgba(0,0,0,0.4)] sm:right-auto sm:left-0"
    >
      {quickEmojis.map((emoji) => (
        <button
          key={emoji.value}
          type="button"
          aria-label={`${emoji.label} emojisini ekle`}
          onClick={() => onSelect(emoji.value)}
          className={`grid size-10 place-items-center rounded-lg text-xl transition-colors hover:bg-[#5a1f32]/8 dark:hover:bg-[#c7896d]/10 ${focusRing}`}
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
