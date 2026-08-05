"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  type CampusReportReason,
  useCampusModeration,
} from "@/components/CampusModerationProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusComment,
} from "@/data/campusPosts";

const reportReasons: { id: CampusReportReason; label: string }[] = [
  { id: "spam", label: "Spam veya reklam" },
  { id: "harassment", label: "Taciz veya zorbalık" },
  { id: "personal_information", label: "Kişisel bilgi" },
  { id: "misleading", label: "Yanıltıcı içerik" },
  { id: "other", label: "Başka bir neden" },
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

export default function CampusCommentActions({
  postId,
  comment,
  onReply,
}: {
  postId: string;
  comment: CampusComment;
  onReply: () => void;
}) {
  const router = useRouter();
  const { isGuest } = useCampusAccount();
  const { updateComment, deleteComment, toggleCommentLike } =
    useCampusData();

  const toggleLike = async () => {
    if (isGuest) {
      return;
    }

    await toggleCommentLike(postId, comment.id);
  };
  const {
    blockUser,
    hasReportedComment,
    reportComment,
  } = useCampusModeration();
  const { confirm: confirmAction, showToast } = useFeedback();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "report" | null>(null);
  const [editBody, setEditBody] = useState(comment.body);
  const [reportReason, setReportReason] =
    useState<CampusReportReason>("spam");
  const [reportDetail, setReportDetail] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const isOwnComment =
    comment.authorId === LOCAL_ACCOUNT_OWNER_ID ||
    comment.author === "@sen";
  const canBlock =
    !comment.isAnonymous &&
    Boolean(comment.authorId) &&
    comment.authorId !== LOCAL_ACCOUNT_OWNER_ID &&
    comment.authorId !== CAMPUS_OFFICIAL_AUTHOR_ID;
  const isReported = hasReportedComment(comment.id);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const closeMenu = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        requestAnimationFrame(() => menuTriggerRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocusElement = menuTriggerRef.current;
    const focusFrame = requestAnimationFrame(() =>
      headingRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDialog(null);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus();
      } else if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [dialog]);

  if (comment.isDeleted) {
    return null;
  }

  const requireMember = () => {
    if (!isGuest) {
      return false;
    }

    showToast({
      message: "Bu işlem için giriş yap veya kayıt ol.",
      tone: "info",
      action: {
        label: "Giriş yap",
        onClick: () => router.push("/giris"),
      },
    });
    return true;
  };

  const openReply = () => {
    if (!requireMember()) {
      onReply();
    }
  };

  const openMenu = () => {
    if (!requireMember()) {
      setIsMenuOpen((currentValue) => !currentValue);
    }
  };

  const openEdit = () => {
    setIsMenuOpen(false);
    setEditBody(comment.body);
    setFormMessage("");
    setDialog("edit");
  };

  const submitEdit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormMessage("Yorum güncelleniyor…");

    try {
      const wasUpdated = await updateComment(
        postId,
        comment.id,
        editBody,
      );

      if (!wasUpdated) {
        setFormMessage("Yorum boş bırakılamaz.");
        return;
      }

      // Pencere kapanıyor ve metin ekranda değişiyor; toast tekrar olurdu.
      setDialog(null);
    } catch {
      setFormMessage("Yorum güncellenemedi. Tekrar dene.");
    }
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    const confirmed = await confirmAction({
      title: "Yorumu silmek istiyor musun?",
      description:
        "Yorumun metni kaldırılacak; konuşma sırası korunacak.",
      confirmLabel: "Yorumu sil",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    let wasDeleted = false;

    try {
      wasDeleted = await deleteComment(postId, comment.id);
    } catch {
      wasDeleted = false;
    }
    showToast({
      message: wasDeleted ? "Yorum silindi." : "Yorum silinemedi.",
      tone: wasDeleted ? "success" : "error",
    });
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const wasAdded = await reportComment(
      comment.id,
      postId,
      reportReason,
      reportDetail,
    );
    setDialog(null);
    setReportDetail("");
    showToast({
      message: wasAdded
        ? "Yorum moderasyon sırasına eklendi."
        : "Bu yorumu daha önce şikâyet ettin.",
      tone: wasAdded ? "success" : "info",
    });
  };

  const handleBlock = async () => {
    setIsMenuOpen(false);

    if (!comment.authorId || !canBlock) {
      return;
    }

    const confirmed = await confirmAction({
      title: `${comment.author} kullanıcısını engellemek istiyor musun?`,
      description:
        "Bu kullanıcının gönderileri ve yorumları artık görünmeyecek.",
      confirmLabel: "Engelle",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const wasBlocked = await blockUser(comment.authorId, comment.author);
    showToast({
      message: wasBlocked
        ? `${comment.author} engellendi.`
        : "Bu kullanıcı zaten engellenmiş.",
      tone: wasBlocked ? "success" : "info",
    });
  };

  return (
    <>
      <div className="mt-2 flex min-h-11 items-center gap-1">
        <button
          type="button"
          aria-pressed={Boolean(comment.liked)}
          aria-label={
            comment.liked
              ? `Beğeniyi kaldır, ${comment.likes ?? 0} beğeni`
              : `Yorumu beğen, ${comment.likes ?? 0} beğeni`
          }
          onClick={() => void toggleLike()}
          className={`campus-pop-on-active inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-sm font-bold transition-colors ${focusRing} ${
            comment.liked
              ? "text-[#df8b83]"
              : "text-white/55 hover:text-[#df8b83]"
          }`}
        >
          <CommentHeartIcon filled={Boolean(comment.liked)} />
          {comment.likes ? <span>{comment.likes}</span> : null}
        </button>

        <button
          type="button"
          onClick={openReply}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-sm font-bold text-white/55 transition-colors hover:text-[#ff7a45] ${focusRing}`}
        >
          <CommentReplyIcon />
          {comment.replyCount ? (
            <span>{comment.replyCount}</span>
          ) : null}
          <span className="hidden min-[380px]:inline">Yanıtla</span>
        </button>

        <div ref={menuRef} className="relative">
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label={`${comment.author} yorumunun seçeneklerini aç`}
            aria-expanded={isMenuOpen}
            onClick={openMenu}
            className={`campus-pop-on-active grid size-10 cursor-pointer place-items-center rounded-full text-white/55 transition-colors hover:bg-white/7 hover:text-white ${focusRing}`}
          >
            <MoreIcon />
          </button>

          {isMenuOpen && (
            <div
              role="group"
              aria-label="Yorum seçenekleri"
              className="absolute top-[calc(100%+0.2rem)] left-1/2 z-40 w-[min(14rem,calc(100vw-1.5rem))] -translate-x-1/2 border border-white/12 bg-[#17191c] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.42)] sm:left-0 sm:w-56 sm:translate-x-0"
            >
              {isOwnComment ? (
                <>
                  <button
                    type="button"
                    onClick={openEdit}
                    className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black hover:bg-white/7 ${focusRing}`}
                  >
                    Yorumu düzenle
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black text-[#ffb199] hover:bg-[#ffb199]/9 ${focusRing}`}
                  >
                    Yorumu sil
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isReported}
                    onClick={() => {
                      setIsMenuOpen(false);
                      setDialog("report");
                    }}
                    className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black hover:bg-white/7 disabled:cursor-default disabled:opacity-45 ${focusRing}`}
                  >
                    {isReported
                      ? "Şikâyet gönderildi"
                      : "Yorumu şikâyet et"}
                  </button>
                  {canBlock && (
                    <button
                      type="button"
                      onClick={handleBlock}
                      className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black text-[#ffb199] hover:bg-[#ffb199]/9 ${focusRing}`}
                    >
                      Kullanıcıyı engelle
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-[145] grid place-items-end overflow-y-auto bg-black/64 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDialog(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`comment-action-title-${comment.id}`}
            className="max-h-[calc(100svh-1.5rem)] w-full max-w-lg overflow-y-auto border border-white/12 bg-[#17191c] p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
                  {dialog === "edit" ? "Yorumun" : "Moderasyon"}
                </p>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  id={`comment-action-title-${comment.id}`}
                  className="mt-1 text-xl font-black tracking-[-0.04em] outline-none"
                >
                  {dialog === "edit"
                    ? "Yorumu düzenle"
                    : "Bu yorumu neden şikâyet ediyorsun?"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Pencereyi kapat"
                onClick={() => setDialog(null)}
                className={`campus-pop-on-active grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-xl text-white/55 hover:bg-white/8 ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {dialog === "edit" ? (
              <form onSubmit={submitEdit} className="mt-5">
                <label
                  htmlFor={`edit-comment-${comment.id}`}
                  className="sr-only"
                >
                  Yorum metni
                </label>
                <textarea
                  id={`edit-comment-${comment.id}`}
                  value={editBody}
                  onChange={(event) => {
                    setEditBody(event.target.value);
                    setFormMessage("");
                  }}
                  maxLength={500}
                  rows={5}
                  className={`min-h-32 w-full resize-y border border-white/12 bg-white/[0.025] px-3 py-2.5 text-sm leading-6 ${focusRing}`}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p
                    role="status"
                    className="text-xs font-semibold text-[#ffb199]"
                  >
                    {formMessage}
                  </p>
                  <span className="font-mono text-[10px] text-white/55">
                    {editBody.length}/500
                  </span>
                </div>
                <DialogButtons
                  onCancel={() => setDialog(null)}
                  submitLabel="Değişiklikleri kaydet"
                  submitDisabled={!editBody.trim()}
                />
              </form>
            ) : (
              <form onSubmit={submitReport} className="mt-5">
                <fieldset>
                  <legend className="sr-only">Şikâyet nedeni</legend>
                  <div className="grid gap-2">
                    {reportReasons.map((reason) => (
                      <label
                        key={reason.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 py-2.5 text-xs font-black ${
                          reportReason === reason.id
                            ? "border-[#ff7a45]/45 bg-[#ff7a45]/8"
                            : "border-white/11"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`comment-report-${comment.id}`}
                          checked={reportReason === reason.id}
                          onChange={() => setReportReason(reason.id)}
                          className="size-4 accent-[#ff7a45]"
                        />
                        {reason.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label
                  htmlFor={`comment-report-detail-${comment.id}`}
                  className="mt-4 block text-xs font-black"
                >
                  Ek açıklama{" "}
                  <span className="font-medium text-white/55">
                    (isteğe bağlı)
                  </span>
                </label>
                <textarea
                  id={`comment-report-detail-${comment.id}`}
                  value={reportDetail}
                  onChange={(event) => setReportDetail(event.target.value)}
                  maxLength={300}
                  rows={3}
                  className={`mt-2 min-h-24 w-full resize-y border border-white/12 bg-white/[0.025] px-3 py-2.5 text-sm leading-6 ${focusRing}`}
                />
                <DialogButtons
                  onCancel={() => setDialog(null)}
                  submitLabel="Şikâyeti gönder"
                />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DialogButtons({
  onCancel,
  submitLabel,
  submitDisabled = false,
}: {
  onCancel: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onCancel}
        className={`min-h-11 cursor-pointer border border-white/12 px-4 text-xs font-black hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
      >
        Vazgeç
      </button>
      <button
        type="submit"
        disabled={submitDisabled}
        className={`min-h-11 cursor-pointer bg-white px-4 text-xs font-black text-[#12100e] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
      >
        {submitLabel}
      </button>
    </div>
  );
}

function CommentReplyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M16.3 9.1c0 3.4-2.8 6-6.3 6a7 7 0 0 1-2.3-.4L4 16l1.1-3A5.8 5.8 0 0 1 3.7 9.1c0-3.4 2.8-6.1 6.3-6.1s6.3 2.7 6.3 6.1Z" />
    </svg>
  );
}

function CommentHeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M10 16.2s-6-3.4-6-8.1A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.1c0 4.7-6 8.1-6 8.1Z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-4"
    >
      <circle cx="4" cy="10" r="1.3" />
      <circle cx="10" cy="10" r="1.3" />
      <circle cx="16" cy="10" r="1.3" />
    </svg>
  );
}
