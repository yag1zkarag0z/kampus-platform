"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { useCampusData } from "@/components/CampusDataProvider";
import type { CampusPostCategory } from "@/data/campusPosts";

const categories: {
  value: CampusPostCategory;
  description: string;
}[] = [
  {
    value: "İtiraf",
    description: "Aklında kalanı kampüsle paylaş.",
  },
  {
    value: "Soru",
    description: "Öğrencilerden fikir veya yardım al.",
  },
  {
    value: "Etkinlik",
    description: "Bir buluşmayı ya da etkinliği duyur.",
  },
  {
    value: "Kayıp Eşya",
    description: "Kayıp veya bulunan bir eşyayı bildir.",
  },
];

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

export default function CreateCampusPost() {
  const router = useRouter();
  const { createPost, isHydrated } = useCampusData();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<CampusPostCategory>("İtiraf");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<
    "neutral" | "error" | "success"
  >("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appendEmoji = (emoji: string) => {
    const textarea = bodyInputRef.current;
    const selectionStart = textarea?.selectionStart ?? body.length;
    const selectionEnd = textarea?.selectionEnd ?? body.length;
    const nextBody =
      body.slice(0, selectionStart) + emoji + body.slice(selectionEnd);

    if (nextBody.length > 500) {
      setStatusMessage("Açıklama en fazla 500 karakter olabilir.");
      setStatusTone("error");
      return;
    }

    setBody(nextBody);
    setStatusMessage("");
    setStatusTone("neutral");
    setIsEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      bodyInputRef.current?.focus();
      bodyInputRef.current?.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition
      );
    });
  };

  const handleEmojiPickerKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === "Escape") {
      setIsEmojiPickerOpen(false);
      bodyInputRef.current?.focus();
    }
  };

  const submitPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();

    if (!isHydrated) {
      setStatusMessage("Konu alanı hazırlanıyor. Birkaç saniye sonra dene.");
      setStatusTone("neutral");
      return;
    }

    if (!normalizedTitle) {
      setTitleError("Konu başlığını yazmalısın.");
      setStatusMessage("Konu yayımlanamadı. Başlık alanını kontrol et.");
      setStatusTone("error");
      titleInputRef.current?.focus();
      return;
    }

    setTitleError("");
    setStatusMessage("Konu yayımlanıyor…");
    setStatusTone("neutral");
    setIsSubmitting(true);

    try {
      const postId = createPost({
        title: normalizedTitle,
        body: normalizedBody,
        category,
        isAnonymous,
      });

      setStatusMessage("Konu yayımlandı. Gönderiye yönlendiriliyorsun.");
      setStatusTone("success");
      router.push(`/gonderi/${postId}`);
    } catch {
      setIsSubmitting(false);
      setStatusMessage(
        "Konu şu anda yayımlanamadı. Bir kez daha deneyebilirsin."
      );
      setStatusTone("error");
    }
  };

  return (
    <section
      aria-labelledby="create-post-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/14 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <Link
            href="/akis"
            aria-label="Kampüs akışına dön"
            className={`grid size-11 shrink-0 place-items-center rounded-full text-xl text-[#1c2821]/70 transition-colors hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-white/65 dark:hover:bg-white/7 dark:hover:text-white ${focusRing}`}
          >
            <span aria-hidden="true">←</span>
          </Link>

          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f3427] dark:text-[#c7896d]">
              Kampüse yaz
            </p>
            <h1
              id="create-post-title"
              className="truncate text-base font-black tracking-[-0.03em]"
            >
              Yeni konu aç
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-6 sm:mb-8">
          <p className="max-w-xl text-sm leading-6 text-[#1c2821]/66 dark:text-white/62">
            Sorunu, duyurunu veya kampüste konuşulmasını istediğin konuyu
            anlaşılır bir başlıkla paylaş.
          </p>
        </div>

        <form
          noValidate
          onSubmit={submitPost}
          className="border-y border-[#1c2821]/13 py-6 dark:border-white/10 sm:border sm:bg-white/20 sm:p-7 dark:sm:bg-white/[0.015]"
        >
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor="campus-post-title"
                className="text-sm font-black tracking-[-0.015em]"
              >
                Başlık
              </label>
              <span className="font-mono text-[10px] font-bold text-[#1c2821]/45 dark:text-white/42">
                {title.length}/100
              </span>
            </div>
            <input
              ref={titleInputRef}
              id="campus-post-title"
              name="title"
              type="text"
              value={title}
              maxLength={100}
              required
              autoFocus
              autoComplete="off"
              aria-invalid={Boolean(titleError)}
              aria-describedby={
                titleError ? "campus-post-title-error" : undefined
              }
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError("");
                setStatusMessage("");
                setStatusTone("neutral");
              }}
              placeholder="Konu ne hakkında?"
              className={`mt-2 min-h-12 w-full border bg-white/35 px-3.5 py-2.5 text-[15px] font-bold text-[#1c2821] placeholder:font-medium placeholder:text-[#1c2821]/38 dark:bg-white/[0.025] dark:text-[#ece8e1] dark:placeholder:text-white/32 ${
                titleError
                  ? "border-[#9b3028] dark:border-[#df8b83]"
                  : "border-[#1c2821]/14 dark:border-white/12"
              } ${focusRing}`}
            />
            {titleError && (
              <p
                id="campus-post-title-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-[#8a2e25] dark:text-[#e0a083]"
              >
                {titleError}
              </p>
            )}
          </div>

          <fieldset className="mt-7">
            <legend className="text-sm font-black tracking-[-0.015em]">
              Kategori
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {categories.map((option) => {
                const isSelected = category === option.value;

                return (
                  <label
                    key={option.value}
                    className={`flex min-h-16 cursor-pointer items-start gap-3 border px-3.5 py-3 transition-colors ${
                      isSelected
                        ? "border-[#9a5944]/60 bg-[#9a5944]/9 dark:border-[#c7896d]/60 dark:bg-[#c7896d]/10"
                        : "border-[#1c2821]/12 bg-white/18 hover:border-[#9a5944]/35 dark:border-white/10 dark:bg-white/[0.015] dark:hover:border-[#c7896d]/35"
                    } ${focusRing}`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setCategory(option.value)}
                      className="mt-0.5 size-4 shrink-0 accent-[#5a1f32] dark:accent-[#c7896d]"
                    />
                    <span>
                      <span className="block text-xs font-black">
                        {option.value}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[#1c2821]/57 dark:text-white/53">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-7">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor="campus-post-body"
                className="text-sm font-black tracking-[-0.015em]"
              >
                Açıklama{" "}
                <span className="font-medium text-[#1c2821]/45 dark:text-white/42">
                  (isteğe bağlı)
                </span>
              </label>
              <span className="font-mono text-[10px] font-bold text-[#1c2821]/45 dark:text-white/42">
                {body.length}/500
              </span>
            </div>
            <textarea
              ref={bodyInputRef}
              id="campus-post-body"
              name="body"
              value={body}
              maxLength={500}
              rows={7}
              aria-describedby="campus-post-body-help"
              onChange={(event) => {
                setBody(event.target.value);
                setStatusMessage("");
                setStatusTone("neutral");
              }}
              placeholder="Detay vermek istersen buraya yazabilirsin."
              className={`mt-2 min-h-40 w-full resize-y border border-[#1c2821]/14 bg-white/35 px-3.5 py-3 text-sm leading-6 text-[#1c2821] placeholder:text-[#1c2821]/38 dark:border-white/12 dark:bg-white/[0.025] dark:text-[#ece8e1] dark:placeholder:text-white/32 ${focusRing}`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p
                id="campus-post-body-help"
                className="text-[11px] leading-5 text-[#1c2821]/52 dark:text-white/48"
              >
                Kişisel bilgi paylaşmamaya dikkat et.
              </p>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Açıklamaya emoji ekle"
                  aria-expanded={isEmojiPickerOpen}
                  aria-controls="campus-post-emoji-picker"
                  onClick={() =>
                    setIsEmojiPickerOpen((currentValue) => !currentValue)
                  }
                  className={`inline-flex min-h-11 items-center gap-2 border border-[#1c2821]/14 px-3 text-xs font-bold transition-colors hover:border-[#5a1f32]/35 hover:bg-[#5a1f32]/6 dark:border-white/12 dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/8 ${focusRing}`}
                >
                  <span aria-hidden="true" className="text-base">
                    ☺
                  </span>
                  Emoji
                </button>

                {isEmojiPickerOpen && (
                  <div
                    id="campus-post-emoji-picker"
                    role="group"
                    aria-label="Açıklama emojileri"
                    onKeyDown={handleEmojiPickerKeyDown}
                    className="absolute right-0 bottom-[calc(100%+0.5rem)] z-40 grid w-52 grid-cols-4 gap-1 border border-[#1c2821]/14 bg-[#fffaf4] p-2 shadow-[0_16px_42px_rgba(28,40,33,0.16)] dark:border-white/12 dark:bg-[#202226] dark:shadow-[0_16px_42px_rgba(0,0,0,0.4)]"
                  >
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji.value}
                        type="button"
                        aria-label={`${emoji.label} emojisini ekle`}
                        onClick={() => appendEmoji(emoji.value)}
                        className={`grid size-11 place-items-center rounded-lg text-xl transition-colors hover:bg-[#5a1f32]/8 dark:hover:bg-[#c7896d]/10 ${focusRing}`}
                      >
                        <span aria-hidden="true">{emoji.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-[#1c2821]/10 pt-5 dark:border-white/8">
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border border-[#1c2821]/13 px-3.5 py-2.5 dark:border-white/11">
              <span>
                <span className="block text-xs font-black">
                  Anonim paylaş
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#1c2821]/55 dark:text-white/50">
                  Adın ve bölüm bilgin gönderide görünmez.
                </span>
              </span>
              <input
                type="checkbox"
                name="anonymous"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
                className={`size-5 shrink-0 accent-[#5a1f32] dark:accent-[#c7896d] ${focusRing}`}
              />
            </label>
          </div>

          <div
            className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`min-h-5 text-xs font-semibold ${
                statusTone === "error"
                  ? "text-[#8a2e25] dark:text-[#e0a083]"
                  : statusTone === "success"
                    ? "text-[#416649] dark:text-[#9fc5a3]"
                    : "text-[#1c2821]/54 dark:text-white/50"
              }`}
            >
              {statusMessage}
            </p>

            <div className="flex shrink-0 gap-2">
              <Link
                href="/akis"
                className={`inline-flex min-h-11 items-center justify-center border border-[#1c2821]/14 px-4 text-xs font-bold text-[#1c2821]/68 transition-colors hover:bg-[#1c2821]/5 hover:text-[#1c2821] dark:border-white/12 dark:text-white/62 dark:hover:bg-white/6 dark:hover:text-white ${focusRing}`}
              >
                Vazgeç
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !isHydrated}
                className={`inline-flex min-h-11 min-w-28 items-center justify-center bg-[#5a1f32] px-5 text-xs font-bold text-white transition-colors hover:bg-[#6b2940] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
              >
                {isSubmitting
                  ? "Yayımlanıyor…"
                  : isHydrated
                    ? "Konuyu yayımla"
                    : "Hazırlanıyor…"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
