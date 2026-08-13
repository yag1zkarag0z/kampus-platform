"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import ActionStatusText from "@/components/ActionStatusText";
import {
  useCampusAccount,
  type CampusAccountSettings,
} from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { campusButton } from "@/components/campusButtonStyles";
import { useCampusData } from "@/components/CampusDataProvider";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import { AuthClientError } from "@/auth/client";

const DELETE_CONFIRMATION = "SIFIRLA";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

type SettingsSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
};

type SettingSwitchProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function getInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "K";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

export default function CampusSettings() {
  const router = useRouter();
  const { confirm: confirmAction } = useFeedback();
  const [deleteStatus, setDeleteStatus] = useActionStatus();
  const [signOutStatus, setSignOutStatus] = useActionStatus();
  const [unblockStatus, setUnblockStatus] = useActionStatus();
  const [unblockAnchor, setUnblockAnchor] = useState<string | null>(null);
  const {
    profile,
    settings,
    isHydrated,
    updateSettings,
    signOut,
    deleteAccount,
  } = useCampusAccount();
  const { resetCampusData } = useCampusData();
  const {
    blockedUsers,
    isHydrated: isModerationHydrated,
    resetModeration,
    unblockUser,
  } = useCampusModeration();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [pendingSetting, setPendingSetting] = useState<
    keyof CampusAccountSettings | null
  >(null);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isResettingLocalData, setIsResettingLocalData] = useState(false);
  const isResettingLocalDataRef = useRef(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const deleteConfirmationRef = useRef<HTMLInputElement>(null);

  const closeDeleteDialog = useCallback(() => {
    if (isResettingLocalDataRef.current) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeleteConfirmation("");
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, []);

  const openDeleteDialog = () => {
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
  };

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() =>
      deleteConfirmationRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDeleteDialog();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = deleteDialogRef.current;

      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDeleteDialog, isDeleteDialogOpen]);

  const handleDeleteAccount = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (deleteConfirmation !== DELETE_CONFIRMATION) {
      deleteConfirmationRef.current?.focus();
      return;
    }

    if (isResettingLocalDataRef.current) {
      return;
    }

    isResettingLocalDataRef.current = true;
    setIsResettingLocalData(true);

    try {
      await deleteAccount();
      resetCampusData();
      resetModeration();
      setIsDeleteDialogOpen(false);
      // AccountProvider aynı anda signed-out state'ine geçtiği için platform
      // guard'ının /giris yönlendirmesiyle yarışmamak adına tam sayfa geçişi.
      window.location.replace("/kayit");
    } catch (error) {
      setDeleteStatus({
        message:
          error instanceof AuthClientError
            ? error.message
            : "Hesabın silinemedi. Lütfen yeniden dene.",
        tone: "error",
      });
    } finally {
      isResettingLocalDataRef.current = false;
      setIsResettingLocalData(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = await confirmAction({
      title: "Çıkış yapmak istiyor musun?",
      description:
        "Profilin ve hesap tercihlerin hesabında kalır. Yalnızca bu cihazdaki oturum kapanır.",
      confirmLabel: "Çıkış yap",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await signOut();
      router.replace("/giris");
    } catch {
      setSignOutStatus({
        message: "Çıkış yapılamadı. Lütfen yeniden dene.",
        tone: "error",
      });
    }
  };

  const handleSettingChange = async (
    setting: keyof CampusAccountSettings,
    checked: boolean,
  ) => {
    if (pendingSetting) {
      return;
    }

    setPendingSetting(setting);
    setSettingsSaveStatus("saving");

    try {
      await updateSettings({
        [setting]: checked,
      } as Partial<CampusAccountSettings>);
      setSettingsSaveStatus("saved");
    } catch {
      setSettingsSaveStatus("error");
      // Üstteki durum etiketi ("Kaydedilemedi") zaten geri bildirimi veriyor.
    } finally {
      setPendingSetting(null);
    }
  };

  const hasMismatchedDeleteConfirmation =
    deleteConfirmation.length > 0 &&
    deleteConfirmation !== DELETE_CONFIRMATION;
  const settingsStatusLabel =
    settingsSaveStatus === "saving"
      ? "Kaydediliyor…"
      : settingsSaveStatus === "saved"
        ? "Kaydedildi"
        : settingsSaveStatus === "error"
          ? "Kaydedilemedi"
          : isHydrated
            ? "Hesabında saklanır"
            : "Yükleniyor…";

  return (
    <section
      aria-labelledby="settings-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-canvas text-white md:min-h-svh"
    >
      <div
        inert={isDeleteDialogOpen ? true : undefined}
        aria-hidden={isDeleteDialogOpen ? true : undefined}
      >
        <header className="sticky top-0 z-30 border-b border-white/12 bg-canvas/94 backdrop-blur-xl">
          <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-6">
            <Link
              href="/profil"
              aria-label="Profile dön"
              className={`grid size-11 shrink-0 place-items-center justify-self-start rounded-full text-white/62 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
            >
              <BackIcon />
            </Link>
            <div className="min-w-0 justify-self-center text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand sm:text-[11px]">
                Hesap
              </p>
              <h1
                id="settings-title"
                className="truncate text-xl font-black tracking-[-0.04em]"
              >
                Ayarlar
              </h1>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="hidden justify-self-end text-right text-xs font-semibold text-white/55 min-[400px]:block"
            >
              {settingsStatusLabel}
            </p>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only min-[400px]:hidden"
            >
              {settingsStatusLabel}
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-7 lg:py-9">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="grid min-w-0 gap-4">
            <SettingsSection
              eyebrow="Hesap özeti"
              title="Kampüs kimliğin"
              description="Toplulukta görünen temel hesap bilgilerin."
            >
              <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
                <div
                  aria-hidden="true"
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-white/12 bg-white/7 bg-cover bg-center text-sm font-black text-brand sm:size-16"
                  style={
                    profile.avatarUrl
                      ? { backgroundImage: `url("${profile.avatarUrl}")` }
                      : undefined
                  }
                >
                  {!profile.avatarUrl && getInitials(profile.displayName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 truncate text-base font-black tracking-[-0.025em] sm:text-lg">
                      {profile.displayName}
                    </p>
                    <span className="inline-flex min-h-6 shrink-0 items-center rounded-full bg-brand/10 px-2 text-[10px] font-black text-brand">
                      Öğrenci profili
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-white/55">
                    @{profile.username}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-white/55">
                    {settings.showDepartment
                      ? `${profile.department} · ${profile.year}`
                      : "Bölüm ve sınıf bilgisi gizli"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-white/8 pt-4">
                <p className="text-xs leading-5 text-white/55">
                  Profil bilgilerini buradan yönetebilirsin. İletişim adresin
                  profilinde yayınlanmaz.
                </p>
                <Link
                  href="/profil/duzenle"
                  className={`mt-4 ${campusButton.secondary} hover:text-brand `}
                >
                  Profili düzenle
                </Link>
              </div>
            </SettingsSection>

            <SettingsSection
              eyebrow="Gizlilik"
              title="Profil görünürlüğü"
              description="Toplulukta hangi profil bilgilerinin görüneceğini seç."
            >
              <SettingSwitch
                id="show-department"
                label="Bölüm ve sınıfı göster"
                description="Profilinde ve kendi adınla yaptığın paylaşımlarda bölüm bilgini gösterir."
                checked={settings.showDepartment}
                disabled={!isHydrated || pendingSetting !== null}
                onChange={(showDepartment) => {
                  void handleSettingChange(
                    "showDepartment",
                    showDepartment,
                  );
                }}
              />

              <div className="mt-4 border-l-2 border-brand/40 bg-brand/6 px-3 py-3 sm:px-4">
                <p className="text-xs font-black text-brand">
                  Anonim içerikler ayrı tutulur
                </p>
                <p className="mt-1 text-xs leading-5 text-white/62">
                  Anonim konular ve yorumlar profilinde gösterilmez; bu
                  içeriklerde bölüm veya sınıf bilgin de paylaşılmaz.
                </p>
              </div>
            </SettingsSection>
          </div>

          <div className="grid min-w-0 gap-4">
            <SettingsSection
              eyebrow="Bildirimler"
              title="Seni ne zaman bilgilendirelim?"
              description="Uygulama içindeki bildirim tercihlerini ayrı ayrı yönet."
            >
              <div className="divide-y divide-white/8">
                <SettingSwitch
                  id="notify-replies"
                  label="Yanıtlar"
                  description="Konu veya yorumlarına yeni bir yanıt geldiğinde."
                  checked={settings.notifyReplies}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyReplies) => {
                    void handleSettingChange(
                      "notifyReplies",
                      notifyReplies,
                    );
                  }}
                />
                <SettingSwitch
                  id="notify-likes"
                  label="Beğeniler"
                  description="Konu veya yorumların beğenildiğinde."
                  checked={settings.notifyLikes}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyLikes) => {
                    void handleSettingChange("notifyLikes", notifyLikes);
                  }}
                />
                <SettingSwitch
                  id="notify-comments"
                  label="Yorumlar"
                  description="Bir gönderine yeni bir yorum geldiğinde."
                  checked={settings.notifyComments}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyComments) => {
                    void handleSettingChange(
                      "notifyComments",
                      notifyComments,
                    );
                  }}
                />
                <SettingSwitch
                  id="notify-mentions"
                  label="Bahsetmeler"
                  description="Bir yorumda senden @kullaniciadi ile bahsedildiğinde."
                  checked={settings.notifyMentions}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyMentions) => {
                    void handleSettingChange(
                      "notifyMentions",
                      notifyMentions,
                    );
                  }}
                />
                <SettingSwitch
                  id="notify-follows"
                  label="Yeni takipçiler"
                  description="Biri seni takip etmeye başladığında."
                  checked={settings.notifyFollows}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyFollows) => {
                    void handleSettingChange(
                      "notifyFollows",
                      notifyFollows,
                    );
                  }}
                />
                <SettingSwitch
                  id="notify-announcements"
                  label="Kampüs duyuruları"
                  description="Topluluğu ilgilendiren önemli duyurular yayınlandığında."
                  checked={settings.notifyAnnouncements}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(notifyAnnouncements) => {
                    void handleSettingChange(
                      "notifyAnnouncements",
                      notifyAnnouncements,
                    );
                  }}
                />
                <SettingSwitch
                  id="email-notifications"
                  label="E-posta bildirimleri"
                  description="Seçtiğin bildirimlerin önemli özetlerini e-postayla al."
                  checked={settings.emailNotifications}
                  disabled={!isHydrated || pendingSetting !== null}
                  onChange={(emailNotifications) => {
                    void handleSettingChange(
                      "emailNotifications",
                      emailNotifications,
                    );
                  }}
                />
              </div>
              <p className="mt-4 border-l-2 border-brand/40 pl-3 text-xs leading-5 text-white/62">
                Tercihlerin hesabında saklanır ve giriş yaptığın cihazlarda
                uygulanır. Bildirim gönderimi etkinleştiğinde bu seçimler
                kullanılacak.
              </p>
            </SettingsSection>

            <SettingsSection
              eyebrow="Güvenlik"
              title="Engellenen kullanıcılar"
              description="Gönderi ve yorumlarını görmek istemediğin hesapları buradan yönet."
            >
              {!isModerationHydrated ? (
                <div
                  aria-busy="true"
                  aria-label="Engellenen kullanıcılar yükleniyor"
                  className="grid gap-3"
                >
                  {[0, 1].map((item) => (
                    <div
                      key={item}
                      aria-hidden="true"
                      className="h-14 animate-pulse bg-white/6 motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : blockedUsers.length > 0 ? (
                <ul className="divide-y divide-white/8">
                  {blockedUsers.map((user) => (
                    <li
                      key={user.authorId}
                      className="flex min-w-0 flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <CampusAuthorAvatar
                        author={user.author}
                        authorId={user.authorId}
                        avatarUrl={user.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {user.author}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/55">
                          Gönderileri ve yorumları gizleniyor
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const succeeded = await unblockUser(
                            user.authorId,
                          );

                          if (!succeeded) {
                            setUnblockAnchor(user.authorId);
                            setUnblockStatus({
                              message:
                                "Engel kaldırılamadı. Lütfen yeniden dene.",
                              tone: "error",
                            });
                          }
                          // Başarılıysa kullanıcı listeden düşüyor; bu zaten geri bildirim.
                        }}
                        className={`min-h-11 shrink-0 cursor-pointer px-3 text-xs font-black text-brand transition-colors hover:bg-brand/8 ${focusRing}`}
                      >
                        Engeli kaldır
                      </button>
                      {unblockStatus && unblockAnchor === user.authorId && (
                        <ActionStatusText
                          status={unblockStatus}
                          className="w-full"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border border-dashed border-white/13 px-4 py-5 text-center">
                  <p className="text-sm font-black">
                    Engellenmiş bir kullanıcı yok
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-white/55">
                    Bir gönderinin seçeneklerinden kullanıcıyı
                    engelleyebilirsin.
                  </p>
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              eyebrow="Oturum"
              title="Çıkış yap"
              description="Profilin ve hesap tercihlerin hesabında saklanır; yalnızca bu cihazdaki oturum kapanır."
            >
              <button
                type="button"
                onClick={handleSignOut}
                className={`inline-flex min-h-11 w-full items-center justify-center border border-white/13 px-4 text-xs font-black text-white transition-colors hover:border-brand/35 hover:bg-brand/8 sm:w-auto ${focusRing}`}
              >
                Çıkış yap
              </button>
              {signOutStatus && (
                <ActionStatusText status={signOutStatus} className="mt-2" />
              )}
            </SettingsSection>

            <SettingsSection
              eyebrow="Tehlikeli alan"
              title="Hesabımı sil"
              description="Bu işlem hesabını kalıcı olarak devre dışı bırakır."
              danger
            >
              <p className="text-xs leading-5 text-white/62">
                Profil ve hesap bilgilerin hemen anonimleştirilir, tüm
                oturumların kapatılır. Paylaşımların 30 günlük silme sürecinin
                sonunda kaldırılır; açık moderasyon kaydı varsa yalnızca kayıt
                süresi tamamlanana kadar anonim tutulur.
              </p>
              <button
                ref={deleteTriggerRef}
                type="button"
                onClick={openDeleteDialog}
                disabled={!isHydrated}
                className={`mt-4 inline-flex min-h-11 w-full items-center justify-center border border-danger/42 px-4 text-xs font-black text-danger transition-colors hover:border-danger hover:bg-danger hover:text-[#101012] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto ${focusRing}`}
              >
                Hesabımı sil
              </button>
            </SettingsSection>
          </div>
          </div>
        </div>
      </div>

      {isDeleteDialogOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-start overflow-y-auto overscroll-contain bg-black/66 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog();
            }
          }}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            className="w-full max-w-lg overflow-y-auto border border-danger/24 bg-surface-raised p-4 text-white shadow-[0_24px_64px_rgba(0,0,0,0.36)] sm:max-h-[calc(100svh-3rem)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-danger">
                  Son onay
                </p>
                <h2
                  id="delete-account-title"
                  className="mt-1 text-xl font-black tracking-[-0.04em] sm:text-2xl"
                >
                  Hesabını silmek istediğine emin misin?
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isResettingLocalData}
                aria-label="Hesap silme penceresini kapat"
                className={`grid size-11 shrink-0 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              id="delete-account-description"
              className="mt-4 text-sm leading-6 text-white/68"
            >
              <p>Onayladığında:</p>
              <ul className="mt-2 grid gap-1.5 pl-5">
                <li className="list-disc">
                  Profilin, öğrenci bilgilerin ve profil fotoğrafın hemen
                  anonimleştirilir,
                </li>
                <li className="list-disc">
                  Tüm oturumların kapatılır ve hesabına bir daha giriş
                  yapılamaz,
                </li>
                <li className="list-disc">
                  Bu cihazdaki yerel konu ve yorumlar, kaydettiklerin ve
                  moderasyon tercihlerin temizlenir.
                </li>
                <li className="list-disc">
                  Paylaşımların 30 günlük teknik silme sürecinin sonunda
                  kaldırılır.
                </li>
              </ul>
              <p className="mt-3 font-bold text-danger">
                Güvenlik için son 30 dakika içinde giriş yapmış olmalısın. Bu
                işlem geri alınamaz.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="mt-5">
              <label
                htmlFor="delete-account-confirmation"
                className="block text-xs font-bold leading-5"
              >
                Devam etmek için aşağıdaki alana tam olarak{" "}
                <span className="font-black text-danger">
                  {DELETE_CONFIRMATION}
                </span>{" "}
                yaz.
              </label>
              <input
                ref={deleteConfirmationRef}
                id="delete-account-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                disabled={isResettingLocalData}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={hasMismatchedDeleteConfirmation}
                aria-describedby={
                  hasMismatchedDeleteConfirmation
                    ? "delete-account-confirmation-error"
                    : undefined
                }
                className={`mt-2 min-h-11 w-full border bg-white/5 px-3 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors placeholder:text-white/40 ${
                  hasMismatchedDeleteConfirmation
                    ? "border-danger"
                    : "border-white/14 focus:border-danger"
                } ${focusRing}`}
              />
              {hasMismatchedDeleteConfirmation && (
                <p
                  id="delete-account-confirmation-error"
                  role="alert"
                  className="mt-2 text-xs font-bold text-danger"
                >
                  Onay metni tam olarak “{DELETE_CONFIRMATION}” olmalı.
                </p>
              )}

              <div className="mt-5 grid gap-2 min-[400px]:grid-cols-2">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={isResettingLocalData}
                  className={`inline-flex min-h-11 items-center justify-center border border-white/13 px-4 text-xs font-black text-white transition-colors hover:bg-white/7 ${focusRing}`}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    deleteConfirmation !== DELETE_CONFIRMATION ||
                    isResettingLocalData
                  }
                  aria-busy={isResettingLocalData}
                  className={`inline-flex min-h-11 items-center justify-center bg-danger px-4 text-xs font-black text-[#101012] transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/35 disabled:text-white/60 ${focusRing}`}
                >
                  {isResettingLocalData
                    ? "Hesap siliniyor…"
                    : "Hesabımı sil"}
                </button>
              </div>
              {deleteStatus && (
                <ActionStatusText status={deleteStatus} className="mt-3" />
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
  danger = false,
}: SettingsSectionProps) {
  return (
    <section
      className={`min-w-0 border bg-white/[0.03] p-4 sm:p-5 ${
        danger ? "border-danger/25" : "border-white/12"
      }`}
    >
      <p
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] ${
          danger ? "text-danger" : "text-brand"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-black tracking-[-0.035em]">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-white/55">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingSwitch({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: SettingSwitchProps) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 pr-1">
        <p id={labelId} className="text-sm font-black">
          {label}
        </p>
        <p
          id={descriptionId}
          className="mt-0.5 max-w-xl text-xs leading-5 text-white/55"
        >
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex min-h-11 w-[3.25rem] shrink-0 items-center rounded-full border px-1 transition-colors disabled:cursor-wait disabled:opacity-45 ${
          checked
            ? "border-brand bg-brand"
            : "border-white/16 bg-white/8"
        } ${focusRing}`}
      >
        <span
          aria-hidden="true"
          className={`block size-5 rounded-full shadow-sm transition-transform ${
            checked ? "translate-x-[1.25rem] bg-white" : "translate-x-0 bg-white/70"
          }`}
        />
      </button>
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[18px]"
    >
      <path
        d="m12.5 4.5-5.5 5.5 5.5 5.5M7.3 10h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[18px]"
    >
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
