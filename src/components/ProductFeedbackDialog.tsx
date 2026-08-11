"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";

import { AuthClientError } from "@/auth/client";
import {
  submitProductFeedback,
  type FeedbackCategoryDto,
} from "@/feedback/client";

const categories: {
  id: FeedbackCategoryDto;
  label: string;
  helper: string;
}[] = [
  { id: "bug", label: "Hata", helper: "Çalışmayan bir şey" },
  { id: "suggestion", label: "Öneri", helper: "Daha iyi bir fikir" },
  { id: "other", label: "Diğer", helper: "Başka bir konu" },
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

export default function ProductFeedbackDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const pathname = usePathname();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [category, setCategory] =
    useState<FeedbackCategoryDto>("suggestion");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const trimmedLength = message.trim().length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = requestAnimationFrame(() =>
      textareaRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmedLength < 20 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      await submitProductFeedback({
        category,
        message: message.trim(),
        pagePath: pathname,
      });
      setIsSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthClientError
          ? error.message
          : "Geri bildirim gönderilemedi. Lütfen yeniden dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[131] grid place-items-end bg-canvas/76 p-0 backdrop-blur-[3px] sm:place-items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full border border-white/12 bg-surface-raised text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)] sm:max-w-[34rem] sm:rounded-[1.4rem]"
      >
        {isSent ? (
          <div className="grid min-h-[22rem] place-items-center p-6 text-center sm:min-h-0 sm:p-9">
            <div>
              <span
                aria-hidden="true"
                className="mx-auto grid size-12 place-items-center rounded-full bg-brand/14 text-2xl text-brand"
              >
                ✓
              </span>
              <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                Bize ulaştı
              </p>
              <h2
                id={titleId}
                className="mt-2 text-2xl font-black tracking-[-0.045em]"
              >
                Teşekkürler.
              </h2>
              <p
                id={descriptionId}
                className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/58"
              >
                Notunu inceleme sıramıza ekledik.
              </p>
              <button
                type="button"
                onClick={onClose}
                className={`mt-6 min-h-11 rounded-full bg-white px-7 text-sm font-black text-[#101012] transition-colors hover:bg-white/88 ${focusRing}`}
              >
                Kapat
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                  KAMPÜS’ü birlikte geliştir
                </p>
                <h2
                  id={titleId}
                  className="mt-2 text-2xl font-black tracking-[-0.045em]"
                >
                  Bir şey mi fark ettin?
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1.5 text-sm text-white/55"
                >
                  Kısa ve net yazman yeterli.
                </p>
              </div>
              <button
                type="button"
                aria-label="Geri bildirim penceresini kapat"
                onClick={onClose}
                className={`grid size-10 shrink-0 place-items-center rounded-full text-xl text-white/50 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
              >
                ×
              </button>
            </header>

            <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6">
              <fieldset>
                <legend className="mb-2.5 text-xs font-black text-white/72">
                  Konu
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((option) => {
                    const isActive = category === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setCategory(option.id)}
                        className={`min-h-14 rounded-xl border px-2 text-left transition-colors ${focusRing} ${
                          isActive
                            ? "border-brand/50 bg-brand/10 text-white"
                            : "border-white/10 bg-white/[0.018] text-white/58 hover:border-white/18 hover:text-white"
                        }`}
                      >
                        <span className="block text-xs font-black">
                          {option.label}
                        </span>
                        <span className="mt-0.5 hidden text-[10px] text-white/42 min-[390px]:block">
                          {option.helper}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="grid gap-2.5">
                <span className="flex items-center justify-between gap-3 text-xs font-black text-white/72">
                  Notun
                  <span className="font-mono text-[10px] font-semibold text-white/38">
                    {message.length}/1000
                  </span>
                </span>
                <textarea
                  ref={textareaRef}
                  value={message}
                  maxLength={1000}
                  rows={5}
                  placeholder="Ne oldu veya neyi daha iyi yapabiliriz?"
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setErrorMessage(undefined);
                  }}
                  className={`min-h-32 resize-none rounded-xl border border-white/10 bg-canvas/55 px-4 py-3.5 text-[16px] leading-6 text-white placeholder:text-white/28 hover:border-white/16 focus:border-brand/45 ${focusRing}`}
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-white/34">
                  Sayfa · {pathname}
                </p>
                {trimmedLength > 0 && trimmedLength < 20 && (
                  <p className="shrink-0 text-[11px] font-bold text-brand">
                    {20 - trimmedLength} karakter daha
                  </p>
                )}
              </div>

              {errorMessage && (
                <p role="alert" className="text-sm font-semibold text-danger">
                  {errorMessage}
                </p>
              )}
            </div>

            <footer className="grid grid-cols-[0.72fr_1.28fr] gap-2 border-t border-white/8 bg-white/[0.018] px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className={`min-h-12 rounded-full border border-white/10 text-sm font-black text-white/68 transition-colors hover:bg-white/6 hover:text-white ${focusRing}`}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={trimmedLength < 20 || isSubmitting}
                className={`min-h-12 rounded-full bg-brand px-5 text-sm font-black text-[#101012] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 ${focusRing}`}
              >
                {isSubmitting ? "Gönderiliyor…" : "Geri bildirim gönder"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
