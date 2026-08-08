"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  type CampusReportReason,
  useCampusModeration,
} from "@/components/CampusModerationProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusPost,
} from "@/data/campusPosts";

const reportReasons: {
  id: CampusReportReason;
  label: string;
  description: string;
}[] = [
  {
    id: "spam",
    label: "Spam veya reklam",
    description: "Tekrarlanan, ilgisiz ya da reklam amaçlı içerik.",
  },
  {
    id: "harassment",
    label: "Taciz veya zorbalık",
    description: "Bir kişiyi hedef alan hakaret, tehdit ya da baskı.",
  },
  {
    id: "personal_information",
    label: "Kişisel bilgi",
    description: "İzinsiz telefon, adres, fotoğraf veya kimlik bilgisi.",
  },
  {
    id: "misleading",
    label: "Yanıltıcı içerik",
    description: "Topluluğu yanıltabilecek sahte veya çarpıtılmış bilgi.",
  },
  {
    id: "other",
    label: "Başka bir neden",
    description: "Yukarıdakiler dışında topluluk kurallarına aykırı içerik.",
  },
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

export default function CampusPostActions({
  post,
  redirectAfterBlock = false,
  redirectAfterDelete = false,
}: {
  post: CampusPost;
  redirectAfterBlock?: boolean;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const { isGuest } = useCampusAccount();
  const { confirm: confirmAction } = useFeedback();
  const [status, setStatus] = useActionStatus();
  const { deletePost, updatePost } = useCampusData();
  const {
    blockUser,
    hasReportedPost,
    reportPost,
  } = useCampusModeration();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editMessage, setEditMessage] = useState("");
  const [reportReason, setReportReason] =
    useState<CampusReportReason>("spam");
  const [reportDetail, setReportDetail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const reportDialogRef = useRef<HTMLDivElement>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const editHeadingRef = useRef<HTMLHeadingElement>(null);
  const isOwnPost =
    post.authorId === LOCAL_ACCOUNT_OWNER_ID || post.author === "@sen";
  const isAnonymous = isAnonymousCampusAuthor(post);
  const canBlock =
    !isAnonymous &&
    Boolean(post.authorId) &&
    post.authorId !== LOCAL_ACCOUNT_OWNER_ID &&
    post.authorId !== CAMPUS_OFFICIAL_AUTHOR_ID;
  const isReported = hasReportedPost(post.id);

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
    const closeMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        requestAnimationFrame(() => menuTriggerRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenuWithEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenuWithEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const activeDialogRef = isReportDialogOpen
      ? reportDialogRef
      : isEditDialogOpen
        ? editDialogRef
        : null;
    const activeHeadingRef = isReportDialogOpen
      ? reportHeadingRef
      : editHeadingRef;

    if (!activeDialogRef) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocusElement = menuTriggerRef.current;
    const focusFrame = requestAnimationFrame(() =>
      activeHeadingRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsReportDialogOpen(false);
        setIsEditDialogOpen(false);
        return;
      }

      if (event.key !== "Tab" || !activeDialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        activeDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
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
      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus();
      } else if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [isEditDialogOpen, isReportDialogOpen]);

  if (post.isDeleted) {
    return null;
  }

  const openMenu = () => {
    if (isGuest) {
      setStatus({
        message: "Şikâyet ve engelleme için giriş yap veya kayıt ol.",
        tone: "error",
        action: {
          label: "Giriş yap",
          onClick: () => router.push("/giris"),
        },
      });
      return;
    }

    setIsMenuOpen((currentValue) => !currentValue);
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const wasAdded = await reportPost(post.id, reportReason, reportDetail);

    setIsReportDialogOpen(false);
    setReportDetail("");
    setStatus({
      message: wasAdded
        ? "Şikâyetin moderasyon sırasına eklendi."
        : "Bu gönderiyi daha önce şikâyet ettin.",
      tone: wasAdded ? "success" : "error",
    });
  };

  const handleBlock = async () => {
    setIsMenuOpen(false);

    if (!post.authorId || !canBlock) {
      return;
    }

    const confirmed = await confirmAction({
      title: `${post.author} kullanıcısını engellemek istiyor musun?`,
      description:
        "Bu kullanıcının gönderileri ve yorumları akışında görünmeyecek. Engeli Ayarlar’dan kaldırabilirsin.",
      confirmLabel: "Engelle",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const wasAdded = await blockUser(post.authorId, post.author);
    setStatus({
      message: wasAdded
        ? `${post.author} engellendi.`
        : "Bu kullanıcı zaten engellenmiş.",
      tone: wasAdded ? "success" : "error",
    });

    if (wasAdded && redirectAfterBlock) {
      router.replace("/akis");
    }
  };

  const openEditDialog = () => {
    setIsMenuOpen(false);
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditMessage("");
    setIsEditDialogOpen(true);
  };

  const submitEdit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setEditMessage("Gönderi güncelleniyor…");

    try {
      const wasUpdated = await updatePost(post.id, {
        title: editTitle,
        body: editBody,
      });

      if (!wasUpdated) {
        setEditMessage("Başlık veya açıklamayı kontrol et.");
        return;
      }

      // Pencere kapanıyor ve metin ekranda değişiyor; toast tekrar olurdu.
      setIsEditDialogOpen(false);
    } catch {
      setEditMessage("Gönderi güncellenemedi. Tekrar dene.");
    }
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    const confirmed = await confirmAction({
      title: "Gönderiyi silmek istiyor musun?",
      description:
        "Gönderinin içeriği kaldırılacak ve yerinde bilgilendirme mesajı kalacak.",
      confirmLabel: "Gönderiyi sil",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    let wasDeleted = false;

    try {
      wasDeleted = await deletePost(post.id);
    } catch {
      wasDeleted = false;
    }
    setStatus({
      message: wasDeleted
        ? "Gönderi silindi."
        : "Gönderi silinemedi.",
      tone: wasDeleted ? "success" : "error",
    });

    if (wasDeleted && redirectAfterDelete) {
      router.replace("/akis");
    }
  };

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          ref={menuTriggerRef}
          type="button"
          aria-label="Gönderi seçeneklerini aç"
          aria-expanded={isMenuOpen}
          onClick={openMenu}
          className={`grid size-11 cursor-pointer place-items-center rounded-full text-white/55 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
        >
          <MoreIcon />
        </button>

        {status && (
          <ActionStatusText
            status={status}
            className="absolute top-full right-0 z-40 w-56 text-right"
          />
        )}

        {isMenuOpen && (
          <div
            role="group"
            aria-label="Gönderi seçenekleri"
            className="absolute right-0 top-[calc(100%+0.25rem)] z-40 w-60 border border-white/12 bg-surface-raised p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
          >
            {isOwnPost ? (
              <>
                <button
                  type="button"
                  onClick={openEditDialog}
                  className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black transition-colors hover:bg-white/7 ${focusRing}`}
                >
                  Gönderiyi düzenle
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black text-danger transition-colors hover:bg-danger/9 ${focusRing}`}
                >
                  Gönderiyi sil
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isReported}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReportDialogOpen(true);
                  }}
                  className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black transition-colors hover:bg-white/7 disabled:cursor-default disabled:text-white/35 ${focusRing}`}
                >
                  {isReported
                    ? "Şikâyet gönderildi"
                    : "Gönderiyi şikâyet et"}
                </button>
                {canBlock && (
                  <button
                    type="button"
                    onClick={handleBlock}
                    className={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-xs font-black text-danger transition-colors hover:bg-danger/9 ${focusRing}`}
                  >
                    Kullanıcıyı engelle
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isReportDialogOpen && (
        <div
          className="fixed inset-0 z-[140] grid place-items-end overflow-y-auto bg-[#101512]/64 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsReportDialogOpen(false);
            }
          }}
        >
          <div
            ref={reportDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`report-post-title-${post.id}`}
            aria-describedby={`report-post-description-${post.id}`}
            className="max-h-[calc(100svh-1.5rem)] w-full max-w-lg overflow-y-auto border border-white/12 bg-surface-raised p-4 text-white shadow-[0_24px_64px_rgba(0,0,0,0.36)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                  Moderasyon
                </p>
                <h2
                  ref={reportHeadingRef}
                  tabIndex={-1}
                  id={`report-post-title-${post.id}`}
                  className="mt-1 text-xl font-black tracking-[-0.04em] outline-none"
                >
                  Bu gönderiyi neden şikâyet ediyorsun?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Şikâyet penceresini kapat"
                onClick={() => setIsReportDialogOpen(false)}
                className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-xl text-white/55 hover:bg-white/8 ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p
              id={`report-post-description-${post.id}`}
              className="mt-3 text-xs leading-5 text-white/55"
            >
              Bildirimin diğer kullanıcılarla paylaşılmaz. Moderasyon ekibi
              içeriği topluluk kurallarına göre değerlendirir.
            </p>

            <form onSubmit={submitReport} className="mt-5">
              <fieldset>
                <legend className="sr-only">Şikâyet nedeni</legend>
                <div className="grid gap-2">
                  {reportReasons.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex min-h-16 cursor-pointer items-start gap-3 border px-3 py-3 transition-colors ${
                        reportReason === reason.id
                          ? "border-brand/45 bg-brand/8"
                          : "border-white/12 hover:border-brand/28"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`report-reason-${post.id}`}
                        value={reason.id}
                        checked={reportReason === reason.id}
                        onChange={() => setReportReason(reason.id)}
                        className="mt-0.5 size-4 shrink-0 accent-brand"
                      />
                      <span>
                        <span className="block text-xs font-black">
                          {reason.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-white/55">
                          {reason.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label
                htmlFor={`report-detail-${post.id}`}
                className="mt-4 block text-xs font-black"
              >
                Ek açıklama{" "}
                <span className="font-medium text-white/55">
                  (isteğe bağlı)
                </span>
              </label>
              <textarea
                id={`report-detail-${post.id}`}
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Moderasyon ekibinin bilmesi gereken bir ayrıntı varsa yaz."
                className={`mt-2 min-h-24 w-full resize-y border border-white/12 bg-white/[0.025] px-3 py-2.5 text-sm leading-6 placeholder:text-white/45 ${focusRing}`}
              />
              <div className="mt-1 text-right font-mono text-[10px] text-white/55">
                {reportDetail.length}/300
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportDialogOpen(false)}
                  className={`min-h-11 cursor-pointer border border-white/12 px-4 text-xs font-black hover:border-brand/35 hover:bg-brand/8 ${focusRing}`}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`min-h-11 cursor-pointer bg-white px-4 text-xs font-black text-[#101012] hover:bg-white/90 ${focusRing}`}
                >
                  Şikâyeti gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditDialogOpen && (
        <div
          className="fixed inset-0 z-[140] grid place-items-end overflow-y-auto bg-[#101512]/64 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsEditDialogOpen(false);
            }
          }}
        >
          <div
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-post-title-${post.id}`}
            className="max-h-[calc(100svh-1.5rem)] w-full max-w-xl overflow-y-auto border border-white/12 bg-surface-raised p-4 text-white shadow-[0_24px_64px_rgba(0,0,0,0.36)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                  Gönderin
                </p>
                <h2
                  ref={editHeadingRef}
                  id={`edit-post-title-${post.id}`}
                  tabIndex={-1}
                  className="mt-1 text-xl font-black tracking-[-0.04em] outline-none"
                >
                  Gönderiyi düzenle
                </h2>
              </div>
              <button
                type="button"
                aria-label="Düzenleme penceresini kapat"
                onClick={() => setIsEditDialogOpen(false)}
                className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-xl text-white/55 hover:bg-white/8 ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={submitEdit} className="mt-5">
              <label
                htmlFor={`edit-post-heading-${post.id}`}
                className="block text-xs font-black"
              >
                Başlık
              </label>
              <input
                id={`edit-post-heading-${post.id}`}
                value={editTitle}
                onChange={(event) => {
                  setEditTitle(event.target.value);
                  setEditMessage("");
                }}
                maxLength={100}
                aria-describedby={`edit-post-heading-count-${post.id}`}
                className={`mt-2 min-h-11 w-full border border-white/12 bg-white/[0.025] px-3 text-sm ${focusRing}`}
              />
              <p
                id={`edit-post-heading-count-${post.id}`}
                className="mt-1 text-right font-mono text-[10px] text-white/55"
              >
                {editTitle.length}/100
              </p>

              <label
                htmlFor={`edit-post-body-${post.id}`}
                className="mt-4 block text-xs font-black"
              >
                Açıklama
              </label>
              <textarea
                id={`edit-post-body-${post.id}`}
                value={editBody}
                onChange={(event) => {
                  setEditBody(event.target.value);
                  setEditMessage("");
                }}
                maxLength={500}
                rows={6}
                aria-describedby={`edit-post-body-count-${post.id}`}
                className={`mt-2 min-h-36 w-full resize-y border border-white/12 bg-white/[0.025] px-3 py-2.5 text-sm leading-6 ${focusRing}`}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs font-semibold text-danger"
                >
                  {editMessage}
                </p>
                <span
                  id={`edit-post-body-count-${post.id}`}
                  className="font-mono text-[10px] text-white/55"
                >
                  {editBody.length}/500
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  className={`min-h-11 cursor-pointer border border-white/12 px-4 text-xs font-black hover:border-brand/35 hover:bg-brand/8 ${focusRing}`}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() && !editBody.trim()}
                  className={`min-h-11 cursor-pointer bg-white px-4 text-xs font-black text-[#101012] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
                >
                  Değişiklikleri kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5"
    >
      <circle cx="4" cy="10" r="1.35" />
      <circle cx="10" cy="10" r="1.35" />
      <circle cx="16" cy="10" r="1.35" />
    </svg>
  );
}
