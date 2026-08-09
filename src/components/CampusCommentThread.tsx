"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import CampusCommentActions from "@/components/CampusCommentActions";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusEmojiPicker from "@/components/CampusEmojiPicker";
import CampusGif from "@/components/CampusGif";
import GiphyPicker from "@/components/GiphyPicker";
import { campusButton } from "@/components/campusButtonStyles";
import { useActionStatus } from "@/components/useActionStatus";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
import { formatCampusAbsoluteDateTime } from "@/content/adapter";
import {
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusGif as CampusGifData,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

/**
 * Bir yorumu gönderi gibi açar: üstte hedef yorum, altında yanıtları ve
 * yanıt kutusu. Gönderi bağlamı için başlıktaki geri oku kullanılır.
 *
 * Şema yanıtları tek seviyeye düzleştirdiği için buradan yazılan yanıt her
 * zaman kök yoruma bağlanır; görsel sıra korunur.
 */
export default function CampusCommentThread({
  postId,
  commentId,
}: {
  postId: string;
  commentId: string;
}) {
  const { isGuest } = useCampusAccount();
  const [replyStatus, setReplyStatus] = useActionStatus();
  const { posts, isHydrated, addComment, loadPostDetail } = useCampusData();
  const [draft, setDraft] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedGif, setSelectedGif] = useState<CampusGifData | undefined>();
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrowTextarea(inputRef, draft);

  const appendEmoji = (emoji: string) => {
    setDraft((currentDraft) =>
      currentDraft.length + emoji.length <= 500
        ? `${currentDraft}${emoji}`
        : currentDraft,
    );
    setIsEmojiPickerOpen(false);
  };

  useEffect(() => {
    if (!isHydrated || isGuest) {
      return;
    }

    let isCancelled = false;

    void loadPostDetail(postId)
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setHasLoaded(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isGuest, isHydrated, loadPostDetail, postId]);

  const post = posts.find((item) => item.id === postId);
  const comment = post?.comments.find((item) => item.id === commentId);
  const replies = post?.comments.filter(
    (item) => item.parentId === commentId && !item.isDeleted,
  );

  if (!post || !comment) {
    return isHydrated && (isGuest || hasLoaded) ? (
      <MissingComment postId={postId} />
    ) : (
      <ThreadLoading />
    );
  }

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const body = draft.trim();

    if ((!body && !selectedGif) || isSubmitting || isGuest) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addComment(postId, {
        body,
        isAnonymous,
        parentId: comment.id,
        gif: selectedGif,
      });
      setDraft("");
      setSelectedGif(undefined);
      setIsGifPickerOpen(false);
      setIsEmojiPickerOpen(false);
      // Yanıt aşağıdaki listede beliriyor; ayrıca haber vermeye gerek yok.
    } catch {
      setReplyStatus({ message: "Yanıt gönderilemedi.", tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-full min-w-0 bg-canvas text-white">
      <header className="sticky top-0 z-30 border-b border-white/12 bg-canvas/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-4 px-3 sm:px-5">
          <Link
            href={`/gonderi/${postId}`}
            aria-label="Gönderiye dön"
            className={`grid size-11 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>
          <h1 className="truncate text-xl font-black tracking-[-0.03em]">
            Yanıtlar
          </h1>
        </div>
      </header>

      <article className="border-b border-white/10 px-4 py-6 sm:px-6">
        <div className="flex items-start gap-3">
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
              avatarUrl={comment.avatarUrl}
              isAnonymous={comment.isAnonymous}
            />
          </CampusAuthorProfileLink>

          {/* Tam tarih gövdenin altında; başlıkta tekrar etmesin. */}
          <div className="min-w-0">
            <p className="text-base font-black">{comment.author}</p>
          </div>
        </div>

        <p className="mt-4 max-w-[78ch] whitespace-pre-wrap break-words text-base leading-8 text-white/85 sm:text-lg">
          {comment.body}
        </p>

        {comment.gif && <CampusGif gif={comment.gif} />}

        {/* Gönderi detayındaki gibi mutlak zaman. */}
        {comment.createdAt !== undefined && (
          <p className="mt-4 text-sm text-white/50">
            <time dateTime={new Date(comment.createdAt).toISOString()}>
              {formatCampusAbsoluteDateTime(comment.createdAt)}
            </time>
            {comment.edited && !comment.isDeleted ? " · düzenlendi" : ""}
          </p>
        )}

        {/* Beğeni ve yanıt aksiyonları burada da bulunur. */}
        <CampusCommentActions
          postId={postId}
          comment={comment}
          onReply={() => inputRef.current?.focus()}
        />
      </article>

      <form
        onSubmit={submitReply}
        aria-hidden={isGuest}
        inert={isGuest}
        className="border-b border-white/10 px-4 py-4 sm:px-6"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 min-[480px]:flex min-[480px]:gap-3">
          <CampusAuthorAvatar
            author={isAnonymous ? "Anonim" : "@sen"}
            authorId={LOCAL_ACCOUNT_OWNER_ID}
            isAnonymous={isAnonymous}
            className="shrink-0"
          />
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            rows={1}
            placeholder="Yanıtını yaz"
            aria-label="Yanıt metni"
            className="min-h-12 w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-lg font-semibold leading-7 text-white outline-none placeholder:font-medium placeholder:text-white/42 focus:outline-none focus:ring-0 sm:text-xl"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !selectedGif) || isSubmitting}
            className={`col-start-2 w-fit shrink-0 justify-self-end min-[480px]:self-center ${campusButton.primary}`}
          >
            Yanıtla
          </button>
        </div>

        {selectedGif && (
          <div className="relative mt-2">
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

        {/* Yanıt kutusu da gönderi kutusuyla aynı araçlara sahip. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-white/12 px-3 text-xs font-bold">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              className="size-4 accent-brand"
            />
            Anonim
          </label>

          <div className="relative">
            <button
              type="button"
              aria-label="Yanıta emoji ekle"
              aria-expanded={isEmojiPickerOpen}
              onClick={() =>
                setIsEmojiPickerOpen((currentValue) => !currentValue)
              }
              className={`grid size-11 place-items-center border border-white/12 text-lg transition-colors hover:border-brand/35 hover:bg-brand/8 ${focusRing}`}
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
              aria-label="Yanıta GIF ekle"
              aria-expanded={isGifPickerOpen}
              onClick={() => setIsGifPickerOpen((value) => !value)}
              className={`grid size-11 place-items-center border border-white/12 text-[10px] font-black text-brand transition-colors hover:border-brand/35 hover:bg-brand/8 ${focusRing}`}
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

          <span className="ml-auto font-mono text-[11px] text-white/42">
            {draft.length}/500
          </span>
        </div>

        {replyStatus && (
          <ActionStatusText status={replyStatus} className="mt-2" />
        )}
      </form>

      {replies && replies.length > 0 ? (
        <ol>
          {replies.map((reply) => (
            <li
              key={reply.id}
              className="border-b border-white/8 px-4 py-5 last:border-b-0 sm:px-6"
            >
              <div className="flex items-start gap-3">
                <CampusAuthorAvatar
                  author={reply.author}
                  authorId={reply.authorId}
                  avatarUrl={reply.avatarUrl}
                  isAnonymous={reply.isAnonymous}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-black">
                    {reply.author}
                    <span className="text-sm font-semibold text-white/50">
                      {reply.createdAt === undefined ? (
                        reply.time
                      ) : (
                        <time
                          dateTime={new Date(reply.createdAt).toISOString()}
                        >
                          {formatCampusAbsoluteDateTime(reply.createdAt)}
                        </time>
                      )}
                    </span>
                  </p>
                  <p className="mt-2 max-w-[78ch] whitespace-pre-wrap break-words text-base leading-7 text-white/78 sm:leading-8">
                    {reply.body}
                  </p>
                  {reply.gif && <CampusGif gif={reply.gif} compact />}
                  <CampusCommentActions
                    postId={postId}
                    comment={reply}
                    onReply={() => inputRef.current?.focus()}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-white/50 sm:px-6">
          Bu yoruma henüz yanıt yok. İlk yanıtı sen yaz.
        </p>
      )}
    </section>
  );
}

function ThreadLoading() {
  return (
    <div
      role="status"
      className="grid min-h-80 place-items-center px-4 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff6b3d] motion-reduce:animate-none"
      />
    </div>
  );
}

function MissingComment({ postId }: { postId: string }) {
  return (
    <div className="grid min-h-80 place-items-center px-4 py-14 text-center">
      <div>
        <p className="text-lg font-black">Yorum bulunamadı</p>
        <p className="mt-2 text-sm text-white/55">
          Bu yorum kaldırılmış veya artık görüntülenemiyor olabilir.
        </p>
        <Link
          href={`/gonderi/${postId}`}
          className={`mt-6 ${campusButton.primary}`}
        >
          Gönderiye dön
        </Link>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
