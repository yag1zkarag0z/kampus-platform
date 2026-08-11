"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { AuthClientError } from "@/auth/client";
import ActionStatusText from "@/components/ActionStatusText";
import { campusButton, campusFocusRing } from "@/components/campusButtonStyles";
import { useActionStatus } from "@/components/useActionStatus";
import {
  submitReport,
  type ReportReasonDto,
} from "@/moderation/client";

const reportReasons: { id: ReportReasonDto; label: string }[] = [
  { id: "spam", label: "Spam veya reklam" },
  { id: "harassment", label: "Taciz veya zorbalık" },
  { id: "personal_information", label: "Kişisel bilgi" },
  { id: "misleading", label: "Yanıltıcı içerik" },
  { id: "other", label: "Diğer" },
];

export default function CampusMessageReportDialog({
  messageId,
  title = "Mesajı bildir",
  description = "Bildirim yalnızca moderasyon ekibi tarafından incelenir.",
  onClose,
  onReported,
}: {
  messageId: string;
  title?: string;
  description?: string;
  onClose: () => void;
  onReported: (created: boolean) => void;
}) {
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState<ReportReasonDto>("harassment");
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useActionStatus();

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await submitReport({
        targetType: "message",
        targetId: messageId,
        reason,
        detail,
      });
      onReported(result.created);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof AuthClientError
            ? error.message
            : "Mesaj bildirilemedi. Tekrar dene.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-end bg-black/72 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full rounded-t-[1.5rem] border border-white/12 bg-surface-raised p-4 shadow-2xl sm:max-w-md sm:rounded-[1.4rem] sm:p-5"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.13em] text-brand">
              Moderasyon
            </p>
            <h2 id={headingId} className="mt-1 text-xl font-black tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/48">
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Şikâyet penceresini kapat"
            disabled={isSubmitting}
            onClick={onClose}
            className={`grid size-10 shrink-0 place-items-center rounded-full text-xl text-white/55 hover:bg-white/8 hover:text-white disabled:opacity-45 ${campusFocusRing}`}
          >
            ×
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)} className="mt-5">
          <fieldset>
            <legend className="text-[10px] font-black uppercase tracking-[0.1em] text-white/52">
              Neden bildiriyorsun?
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {reportReasons.map((item) => (
                <label
                  key={item.id}
                  className={`flex min-h-11 cursor-pointer items-center rounded-xl border px-3 text-xs font-bold transition-colors ${
                    reason === item.id
                      ? "border-brand/45 bg-brand/9 text-brand"
                      : "border-white/10 bg-white/[0.025] text-white/62 hover:border-white/18"
                  }`}
                >
                  <input
                    type="radio"
                    name="message-report-reason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                    className="sr-only"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/52">
              Açıklama <span className="normal-case text-white/30">(isteğe bağlı)</span>
            </span>
            <textarea
              value={detail}
              maxLength={300}
              rows={3}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Moderasyon ekibinin bilmesi gereken ayrıntı"
              className={`mt-2 w-full resize-none rounded-xl border border-white/12 bg-canvas px-3 py-2.5 text-sm leading-5 text-white placeholder:text-white/32 ${campusFocusRing}`}
            />
          </label>

          {status && <ActionStatusText status={status} className="mt-3" />}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className={campusButton.secondary}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={campusButton.primary}
            >
              {isSubmitting ? "Gönderiliyor…" : "Bildir"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
