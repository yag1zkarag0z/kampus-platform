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

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusData } from "@/components/CampusDataProvider";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import ThemeToggle from "@/components/ThemeToggle";

const DELETE_CONFIRMATION = "SIFIRLA";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf8f1] dark:focus-visible:ring-[#c7896d]/35 dark:focus-visible:ring-offset-[#17191c]";

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
  const { confirm: confirmAction, showToast } = useFeedback();
  const {
    profile,
    settings,
    isHydrated,
    updateSettings,
    resetAccount,
    signOut,
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
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const deleteConfirmationRef = useRef<HTMLInputElement>(null);

  const closeDeleteDialog = useCallback(() => {
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

    resetCampusData();
    resetModeration();
    resetAccount();

    try {
      await signOut();
      setIsDeleteDialogOpen(false);
      router.replace("/kayit");
    } catch {
      showToast({
        message: "Oturum kapatılamadı. Lütfen yeniden dene.",
        tone: "error",
      });
    }
  };

  const handleSignOut = async () => {
    const confirmed = await confirmAction({
      title: "Çıkış yapmak istiyor musun?",
      description:
        "Profilin ve gönderilerin bu cihazda kalır. Yalnızca oturumun kapanır.",
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
      showToast({
        message: "Çıkış yapılamadı. Lütfen yeniden dene.",
        tone: "error",
      });
    }
  };

  const hasMismatchedDeleteConfirmation =
    deleteConfirmation.length > 0 &&
    deleteConfirmation !== DELETE_CONFIRMATION;

  return (
    <section
      aria-labelledby="settings-title"
      aria-busy={!isHydrated}
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <div
        inert={isDeleteDialogOpen ? true : undefined}
        aria-hidden={isDeleteDialogOpen ? true : undefined}
      >
        <header className="sticky top-16 z-30 border-b border-[#1c2821]/12 bg-[#fbf8f1]/94 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/94 md:top-0">
          <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-6">
            <Link
              href="/profil"
              aria-label="Profile dön"
              className={`grid size-11 shrink-0 place-items-center justify-self-start rounded-full text-[#1c2821]/66 transition-colors hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-white/62 dark:hover:bg-white/8 dark:hover:text-[#ece8e1] ${focusRing}`}
            >
              <BackIcon />
            </Link>
            <div className="min-w-0 justify-self-center text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d] sm:text-[11px]">
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
              className="hidden justify-self-end text-right text-xs font-semibold text-[#58635c] dark:text-[#aeb4af] min-[400px]:block"
            >
              {isHydrated ? "Otomatik kaydedilir" : "Yükleniyor…"}
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
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[#1c2821]/12 bg-[#eee9e1] bg-cover bg-center text-sm font-black text-[#5a1f32] dark:border-white/12 dark:bg-white/7 dark:text-[#d09272] sm:size-16"
                  style={
                    profile.avatarDataUrl
                      ? { backgroundImage: `url("${profile.avatarDataUrl}")` }
                      : undefined
                  }
                >
                  {!profile.avatarDataUrl && getInitials(profile.displayName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 truncate text-base font-black tracking-[-0.025em] sm:text-lg">
                      {profile.displayName}
                    </p>
                    <span className="inline-flex min-h-6 shrink-0 items-center rounded-full bg-[#315c48]/9 px-2 text-[10px] font-black text-[#315c48] dark:bg-[#80aa91]/10 dark:text-[#9bc2aa]">
                      Öğrenci profili
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#58635c] dark:text-[#aeb4af]">
                    @{profile.username}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                    {settings.showDepartment
                      ? `${profile.department} · ${profile.year}`
                      : "Bölüm ve sınıf bilgisi gizli"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-[#1c2821]/9 pt-4 dark:border-white/8">
                <p className="text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                  Profil bilgilerini buradan yönetebilirsin. İletişim adresin
                  profilinde yayınlanmaz.
                </p>
                <Link
                  href="/profil/duzenle"
                  className={`mt-4 inline-flex min-h-11 items-center justify-center border border-[#1c2821]/14 px-4 text-xs font-black transition-colors hover:border-[#5a1f32]/32 hover:bg-[#5a1f32]/5 hover:text-[#5a1f32] dark:border-white/12 dark:hover:border-[#c7896d]/38 dark:hover:bg-[#c7896d]/7 dark:hover:text-[#d09272] ${focusRing}`}
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
                disabled={!isHydrated}
                onChange={(showDepartment) =>
                  updateSettings({ showDepartment })
                }
              />

              <div className="mt-4 border-l-2 border-[#9a5944]/38 bg-[#9a5944]/6 px-3 py-3 dark:border-[#c7896d]/42 dark:bg-[#c7896d]/6 sm:px-4">
                <p className="text-xs font-black text-[#5a2538] dark:text-[#d09272]">
                  Anonim içerikler ayrı tutulur
                </p>
                <p className="mt-1 text-xs leading-5 text-[#1c2821]/64 dark:text-white/60">
                  Anonim konular ve yorumlar profilinde gösterilmez; bu
                  içeriklerde bölüm veya sınıf bilgin de paylaşılmaz.
                </p>
              </div>
            </SettingsSection>

            <SettingsSection
              eyebrow="Görünüm"
              title="Renk teması"
              description="Uygulamayı bulunduğun ortama göre açık veya koyu kullan."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                  Tema tercihin bu tarayıcıda saklanır ve tüm KAMPÜS
                  ekranlarına uygulanır.
                </p>
                <ThemeToggle
                  showLabel
                  className="w-full shrink-0 sm:w-auto"
                />
              </div>
            </SettingsSection>
          </div>

          <div className="grid min-w-0 gap-4">
            <SettingsSection
              eyebrow="Bildirimler"
              title="Seni ne zaman bilgilendirelim?"
              description="Uygulama içindeki bildirim tercihlerini ayrı ayrı yönet."
            >
              <div className="divide-y divide-[#1c2821]/9 dark:divide-white/8">
                <SettingSwitch
                  id="notify-replies"
                  label="Yanıtlar"
                  description="Konu veya yorumlarına yeni bir yanıt geldiğinde."
                  checked={settings.notifyReplies}
                  disabled={!isHydrated}
                  onChange={(notifyReplies) =>
                    updateSettings({ notifyReplies })
                  }
                />
                <SettingSwitch
                  id="notify-likes"
                  label="Beğeniler"
                  description="Konu veya yorumların beğenildiğinde."
                  checked={settings.notifyLikes}
                  disabled={!isHydrated}
                  onChange={(notifyLikes) =>
                    updateSettings({ notifyLikes })
                  }
                />
                <SettingSwitch
                  id="notify-announcements"
                  label="Kampüs duyuruları"
                  description="Topluluğu ilgilendiren önemli duyurular yayınlandığında."
                  checked={settings.notifyAnnouncements}
                  disabled={!isHydrated}
                  onChange={(notifyAnnouncements) =>
                    updateSettings({ notifyAnnouncements })
                  }
                />
                <SettingSwitch
                  id="email-notifications"
                  label="E-posta bildirimleri"
                  description="Seçtiğin bildirimlerin önemli özetlerini e-postayla al."
                  checked={settings.emailNotifications}
                  disabled={!isHydrated}
                  onChange={(emailNotifications) =>
                    updateSettings({ emailNotifications })
                  }
                />
              </div>
              <p className="mt-4 border-l-2 border-[#9a5944]/38 pl-3 text-xs leading-5 text-[#1c2821]/64 dark:border-[#c7896d]/42 dark:text-white/60">
                Tercihlerin şimdilik bu cihazda saklanır. Bildirim gönderimi
                backend tamamlandığında etkinleşecek.
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
                      className="h-14 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : blockedUsers.length > 0 ? (
                <ul className="divide-y divide-[#1c2821]/9 dark:divide-white/8">
                  {blockedUsers.map((user) => (
                    <li
                      key={user.authorId}
                      className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <CampusAuthorAvatar
                        author={user.author}
                        authorId={user.authorId}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {user.author}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#58635c] dark:text-[#aeb4af]">
                          Gönderileri ve yorumları gizleniyor
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          unblockUser(user.authorId);
                          showToast({
                            message: `${user.author} için engel kaldırıldı.`,
                            tone: "success",
                          });
                        }}
                        className={`min-h-11 shrink-0 cursor-pointer px-3 text-xs font-black text-[#7d3c2d] transition-colors hover:bg-[#7d3c2d]/7 dark:text-[#d09272] dark:hover:bg-[#c7896d]/8 ${focusRing}`}
                      >
                        Engeli kaldır
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border border-dashed border-[#1c2821]/15 px-4 py-5 text-center dark:border-white/13">
                  <p className="text-sm font-black">
                    Engellenmiş bir kullanıcı yok
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                    Bir gönderinin seçeneklerinden kullanıcıyı
                    engelleyebilirsin.
                  </p>
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              eyebrow="Oturum"
              title="Çıkış yap"
              description="Profilin ve gönderilerin bu cihazda kalır; yalnızca oturumun kapanır."
            >
              <button
                type="button"
                onClick={handleSignOut}
                className={`inline-flex min-h-11 w-full items-center justify-center border border-[#1c2821]/15 px-4 text-xs font-black transition-colors hover:border-[#5a1f32]/35 hover:bg-[#5a1f32]/6 dark:border-white/13 dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/8 sm:w-auto ${focusRing}`}
              >
                Çıkış yap
              </button>
            </SettingsSection>

            <SettingsSection
              eyebrow="Tehlikeli alan"
              title="Yerel verileri sıfırla"
              description="Bu işlem bu cihazda saklanan frontend verilerini temizler."
              danger
            >
              <p className="text-xs leading-5 text-[#1c2821]/64 dark:text-white/60">
                Profil değişikliklerin, oluşturduğun konu ve yorumlar,
                kaydettiklerin ve hesap tercihlerin bu tarayıcıdan temizlenir.
                Varsayılan önizleme hesabına dönersin.
              </p>
              <button
                ref={deleteTriggerRef}
                type="button"
                onClick={openDeleteDialog}
                disabled={!isHydrated}
                className={`mt-4 inline-flex min-h-11 w-full items-center justify-center border border-[#a03c36]/42 px-4 text-xs font-black text-[#8b2f2a] transition-colors hover:border-[#8b2f2a] hover:bg-[#8b2f2a] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#d27368]/42 dark:text-[#e18a7d] dark:hover:border-[#d27368] dark:hover:bg-[#d27368] dark:hover:text-[#17191c] sm:w-auto ${focusRing}`}
              >
                Yerel verileri sıfırla
              </button>
            </SettingsSection>
          </div>
          </div>
        </div>
      </div>

      {isDeleteDialogOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-start overflow-y-auto overscroll-contain bg-[#101512]/66 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
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
            className="w-full max-w-lg overflow-y-auto border border-[#8b2f2a]/24 bg-[#fbf8f1] p-4 text-[#1c2821] shadow-[0_28px_90px_rgba(15,18,16,0.32)] dark:border-[#d27368]/24 dark:bg-[#1d2023] dark:text-[#ece8e1] sm:max-h-[calc(100svh-3rem)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2f2a] dark:text-[#e18a7d]">
                  Son onay
                </p>
                <h2
                  id="delete-account-title"
                  className="mt-1 text-xl font-black tracking-[-0.04em] sm:text-2xl"
                >
                  Bu cihazdaki verileri sıfırlamak istediğine emin misin?
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDeleteDialog}
                aria-label="Veri sıfırlama penceresini kapat"
                className={`grid size-11 shrink-0 place-items-center rounded-full text-[#58635c] transition-colors hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/8 dark:hover:text-white ${focusRing}`}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              id="delete-account-description"
              className="mt-4 text-sm leading-6 text-[#1c2821]/68 dark:text-white/64"
            >
              <p>Onayladığında bu tarayıcıdaki:</p>
              <ul className="mt-2 grid gap-1.5 pl-5">
                <li className="list-disc">
                  Profil değişikliklerin ve hesap tercihlerin,
                </li>
                <li className="list-disc">
                  Oluşturduğun konu ve yorumlar,
                </li>
                <li className="list-disc">
                  Beğeni ve kaydetme tercihlerin temizlenir.
                </li>
              </ul>
              <p className="mt-3 font-bold text-[#8b2f2a] dark:text-[#e18a7d]">
                Bu cihazdaki değişiklikler geri alınamaz.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="mt-5">
              <label
                htmlFor="delete-account-confirmation"
                className="block text-xs font-bold leading-5"
              >
                Devam etmek için aşağıdaki alana tam olarak{" "}
                <span className="font-black text-[#8b2f2a] dark:text-[#e18a7d]">
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
                autoComplete="off"
                spellCheck={false}
                aria-invalid={hasMismatchedDeleteConfirmation}
                aria-describedby={
                  hasMismatchedDeleteConfirmation
                    ? "delete-account-confirmation-error"
                    : undefined
                }
                className={`mt-2 min-h-11 w-full border bg-white/70 px-3 text-sm font-black uppercase tracking-[0.08em] transition-colors placeholder:text-[#68736c] dark:bg-white/[0.035] dark:placeholder:text-[#9ba39d] ${
                  hasMismatchedDeleteConfirmation
                    ? "border-[#a03c36] dark:border-[#d27368]"
                    : "border-[#1c2821]/16 focus:border-[#8b2f2a] dark:border-white/14 dark:focus:border-[#d27368]"
                } ${focusRing}`}
              />
              {hasMismatchedDeleteConfirmation && (
                <p
                  id="delete-account-confirmation-error"
                  role="alert"
                  className="mt-2 text-xs font-bold text-[#8b2f2a] dark:text-[#e18a7d]"
                >
                  Onay metni tam olarak “{DELETE_CONFIRMATION}” olmalı.
                </p>
              )}

              <div className="mt-5 grid gap-2 min-[400px]:grid-cols-2">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  className={`inline-flex min-h-11 items-center justify-center border border-[#1c2821]/15 px-4 text-xs font-black transition-colors hover:bg-[#1c2821]/6 dark:border-white/13 dark:hover:bg-white/7 ${focusRing}`}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={deleteConfirmation !== DELETE_CONFIRMATION}
                  className={`inline-flex min-h-11 items-center justify-center bg-[#8b2f2a] px-4 text-xs font-black text-white transition-colors hover:bg-[#762620] disabled:cursor-not-allowed disabled:bg-[#8b2f2a]/35 disabled:text-white/75 dark:bg-[#d27368] dark:text-[#17191c] dark:hover:bg-[#df887d] dark:disabled:bg-[#d27368]/30 dark:disabled:text-white/45 ${focusRing}`}
                >
                  Verileri sıfırla
                </button>
              </div>
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
      className={`min-w-0 border bg-white/28 p-4 dark:bg-white/[0.018] sm:p-5 ${
        danger
          ? "border-[#a03c36]/25 dark:border-[#d27368]/24"
          : "border-[#1c2821]/11 dark:border-white/9"
      }`}
    >
      <p
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] ${
          danger
            ? "text-[#8b2f2a] dark:text-[#e18a7d]"
            : "text-[#7d3c2d] dark:text-[#c7896d]"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-black tracking-[-0.035em]">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
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
          className="mt-0.5 max-w-xl text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]"
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
            ? "border-[#5a2538] bg-[#5a2538] dark:border-[#c7896d] dark:bg-[#c7896d]"
            : "border-[#1c2821]/18 bg-[#1c2821]/8 dark:border-white/16 dark:bg-white/8"
        } ${focusRing}`}
      >
        <span
          aria-hidden="true"
          className={`block size-5 rounded-full shadow-sm transition-transform ${
            checked
              ? "translate-x-[1.25rem] bg-[#fffaf4] dark:bg-[#17191c]"
              : "translate-x-0 bg-white dark:bg-white/72"
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
