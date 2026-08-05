"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusEmojiPicker from "@/components/CampusEmojiPicker";
import CampusGif from "@/components/CampusGif";
import { useFeedback } from "@/components/FeedbackProvider";
import GiphyPicker from "@/components/GiphyPicker";
import { campusButton } from "@/components/campusButtonStyles";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
import {
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusGif as CampusGifData,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";

/**
 * Gönderiye kök yorum yazma sayfası. Gönderi detayında satır içi kutu yok;
 * yorum yazmak da yanıt yazmak gibi kendi sayfasında yapılır.
 */
export default function CampusCommentCompose({
  postId,
}: {
  postId: string;
}) {
  const router = useRouter();
  const { isGuest } = useCampusAccount();
  const { showToast } = useFeedback();
  const { addComment } = useCampusData();
  const [draft, setDraft] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedGif, setSelectedGif] = useState<CampusGifData | undefined>();
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useAutoGrowTextarea(inputRef, draft);

  // Sayfa yorum yazmak için açıldı; kutu doğrudan hazır olsun.
  useEffect(() => {
    if (!isGuest) {
      inputRef.current?.focus();
    }
  }, [isGuest]);

  const appendEmoji = (emoji: string) => {
    setDraft((currentDraft) =>
      currentDraft.length + emoji.length <= 500
        ? `${currentDraft}${emoji}`
        : currentDraft,
    );
    setIsEmojiPickerOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const body = draft.trim();

    if ((!body && !selectedGif) || isSubmitting || isGuest) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addComment(postId, { body, isAnonymous, gif: selectedGif });
      showToast({
        message: "Yorumun gönderiye eklendi.",
        tone: "success",
      });
      // Geri yığınında boş taslak sayfası kalmasın.
      router.replace(`/gonderi/${postId}`);
    } catch {
      showToast({ message: "Yorum gönderilemedi.", tone: "error" });
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(draft.trim() || selectedGif);

  return (
    <section className="min-h-full min-w-0 bg-[#0a0d16] text-white">
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-4 px-3 sm:px-5">
          <Link
            href={`/gonderi/${postId}`}
            aria-label="Gönderiye dön"
            className={`grid size-11 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>
          <h1 className="truncate text-xl font-black tracking-[-0.03em]">
            Yorum yaz
          </h1>
        </div>
      </header>

      {isGuest ? (
        <div className="px-4 py-14 text-center sm:px-6">
          <p className="text-lg font-black">Yorum yapmak için giriş yap.</p>
          <p className="mt-2 text-sm text-white/55">
            Misafirler gönderileri yalnızca görüntüleyebilir.
          </p>
          <Link href="/giris" className={`mt-6 ${campusButton.primary}`}>
            Giriş yap
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="px-4 py-5 sm:px-6">
          {/* Solda profil, sağda çerçevesiz yazı alanı; akıştaki dille aynı. */}
          <div className="flex items-start gap-3">
            <CampusAuthorAvatar
              author={isAnonymous ? "Anonim" : "@sen"}
              authorId={LOCAL_ACCOUNT_OWNER_ID}
              isAnonymous={isAnonymous}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="campus-comment-compose" className="sr-only">
                Yorumunu ekle
              </label>
              <textarea
                ref={inputRef}
                id="campus-comment-compose"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Ne düşünüyorsun?"
                className="min-h-32 w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-lg font-semibold leading-8 text-white outline-none ring-0 placeholder:font-medium placeholder:text-white/42 focus:outline-none focus:ring-0 focus-visible:ring-0 sm:text-xl"
              />
            </div>
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
                  aria-expanded={isGifPickerOpen}
                  onClick={() => setIsGifPickerOpen((value) => !value)}
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

            <div className="ml-auto flex items-center gap-3">
              <span className="font-mono text-[11px] text-white/42">
                {draft.length}/500
              </span>
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className={`${campusButton.primary} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {isSubmitting ? "Gönderiliyor…" : "Yorum yap"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
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
