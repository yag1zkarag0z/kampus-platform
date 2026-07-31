"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  AuthClientError,
  type UpdateCampusProfileInput,
} from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import {
  getCampusYearOptions,
  isListedYasarDepartment,
  yasarDepartmentGroups,
} from "@/data/yasarDepartments";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;
const acceptedAvatarTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";
const fieldClassName = `mt-2 min-h-12 w-full border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm font-semibold text-white placeholder:font-medium placeholder:text-white/40 ${focusRing}`;

type EditableProfile = {
  displayName: string;
  username: string;
  department: string;
  year: string;
  bio: string;
  avatarDataUrl?: string;
};

type ProfileField =
  | "displayName"
  | "username"
  | "department"
  | "year"
  | "bio";
type FieldErrors = Partial<Record<ProfileField, string>>;

function getInitials(displayName: string) {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);

  return (
    nameParts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("tr-TR") || "K"
  );
}

function normalizeUsername(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 24);
}

function getApiFieldErrors(error: AuthClientError): FieldErrors {
  const nextErrors: FieldErrors = {};
  const fieldAliases: Record<ProfileField, readonly string[]> = {
    displayName: ["displayName"],
    username: ["username"],
    department: ["department"],
    year: ["year", "yearLabel"],
    bio: ["bio"],
  };

  (
    Object.entries(fieldAliases) as [
      ProfileField,
      readonly string[],
    ][]
  ).forEach(([field, aliases]) => {
    const message = aliases
      .flatMap((alias) => error.fieldErrors[alias] ?? [])
      .find(Boolean);

    if (message) {
      nextErrors[field] = message;
    }
  });

  if (
    !nextErrors.username &&
    (error.status === 409 ||
      error.code.toLocaleUpperCase("en-US").includes("USERNAME"))
  ) {
    nextErrors.username =
      "Bu kullanıcı adı başka bir öğrenci tarafından kullanılıyor.";
  }

  return nextErrors;
}

function focusFirstInvalidField() {
  requestAnimationFrame(() => {
    const firstInvalidField = document.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    firstInvalidField?.focus();
  });
}

async function createAvatarDataUrl(file: File) {
  const image = await createImageBitmap(file);

  try {
    const sourceSize = Math.min(image.width, image.height);
    const outputSize = Math.min(AVATAR_OUTPUT_SIZE, sourceSize);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context || outputSize < 1) {
      throw new Error("Avatar canvas could not be created.");
    }

    canvas.width = outputSize;
    canvas.height = outputSize;

    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    image.close();
  }
}

export default function EditCampusProfile() {
  const {
    accountId,
    profile,
    settings,
    isHydrated,
    updateProfile,
    updateSettings,
    updateAvatar,
    removeAvatar,
  } = useCampusAccount();
  const { renameAuthoredContent } = useCampusData();

  if (!isHydrated || !accountId) {
    return <EditProfileLoading />;
  }

  return (
    <EditProfileForm
      key={accountId}
      initialProfile={profile}
      initialShowDepartment={settings.showDepartment}
      updateProfile={updateProfile}
      updateShowDepartment={(showDepartment) =>
        updateSettings({ showDepartment })
      }
      updateAvatar={updateAvatar}
      removeAvatar={removeAvatar}
      renameAuthoredContent={renameAuthoredContent}
    />
  );
}

function EditProfileForm({
  initialProfile,
  initialShowDepartment,
  updateProfile,
  updateShowDepartment,
  updateAvatar,
  removeAvatar,
  renameAuthoredContent,
}: {
  initialProfile: EditableProfile;
  initialShowDepartment: boolean;
  updateProfile: (updates: UpdateCampusProfileInput) => Promise<void>;
  updateShowDepartment: (showDepartment: boolean) => Promise<void>;
  updateAvatar: (avatarDataUrl: string) => boolean;
  removeAvatar: () => boolean;
  renameAuthoredContent: (
    previousUsername: string,
    newUsername: string,
  ) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(
    initialProfile.displayName,
  );
  const [username, setUsername] = useState(initialProfile.username);
  const [department, setDepartment] = useState(initialProfile.department);
  const [year, setYear] = useState(initialProfile.year);
  const [bio, setBio] = useState(initialProfile.bio);
  const [avatarPreview, setAvatarPreview] = useState(
    initialProfile.avatarDataUrl,
  );
  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);
  const [showDepartment, setShowDepartment] = useState(
    initialShowDepartment,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [avatarError, setAvatarError] = useState("");
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(false);
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      saveGenerationRef.current += 1;
    };
  }, []);

  const isCurrentSave = (generation: number) =>
    isMountedRef.current && saveGenerationRef.current === generation;

  const clearFieldError = (field: ProfileField) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setStatusMessage("");
  };

  const handleAvatarChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarError("");
    setStatusMessage("");

    if (!acceptedAvatarTypes.has(file.type)) {
      setAvatarError("PNG, JPEG veya WebP biçiminde bir görsel seçmelisin.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("Profil fotoğrafı en fazla 2 MB olabilir.");
      event.target.value = "";
      return;
    }

    setIsProcessingAvatar(true);

    try {
      const nextAvatar = await createAvatarDataUrl(file);
      setAvatarPreview(nextAvatar);
      setShouldRemoveAvatar(false);
    } catch {
      setAvatarError("Görsel okunamadı. Başka bir dosya deneyebilirsin.");
      event.target.value = "";
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(undefined);
    setShouldRemoveAvatar(true);
    setAvatarError("");
    setStatusMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};
    const normalizedDisplayName = displayName.trim();
    const normalizedUsername = username.trim();
    const normalizedDepartment = department.trim();

    if (normalizedDisplayName.length < 2) {
      nextErrors.displayName = "Görünen ad en az 2 karakter olmalı.";
    } else if (normalizedDisplayName.length > 40) {
      nextErrors.displayName = "Görünen ad en fazla 40 karakter olabilir.";
    }

    if (!campusUsernamePattern.test(normalizedUsername)) {
      nextErrors.username =
        "3–24 karakter kullan; harf veya rakamla başla ve bitir.";
    } else if (reservedCampusUsernames.has(normalizedUsername)) {
      nextErrors.username = "Bu kullanıcı adı KAMPÜS tarafından ayrılmış.";
    }

    if (!normalizedDepartment) {
      nextErrors.department = "Bölümünü yazmalısın.";
    } else if (normalizedDepartment.length > 60) {
      nextErrors.department = "Bölüm adı en fazla 60 karakter olabilir.";
    }

    if (bio.length > 160) {
      nextErrors.bio = "Biyografi en fazla 160 karakter olabilir.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");

    if (isSaving || !validateForm()) {
      if (isSaving) {
        return;
      }

      setStatusMessage("Kaydedilemeyen alanları kontrol et.");
      focusFirstInvalidField();
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    const saveGeneration = saveGenerationRef.current + 1;
    saveGenerationRef.current = saveGeneration;

    const normalizedProfile: UpdateCampusProfileInput = {
      displayName: displayName.trim(),
      username: username.trim(),
      department: department.trim(),
      year,
      bio: bio.trim(),
    };
    let profileWasSaved = false;
    let avatarStorageFailed = false;

    try {
      await updateProfile(normalizedProfile);

      if (!isCurrentSave(saveGeneration)) {
        return;
      }

      profileWasSaved = true;

      if (shouldRemoveAvatar) {
        avatarStorageFailed = !removeAvatar();
      } else if (
        avatarPreview &&
        avatarPreview !== initialProfile.avatarDataUrl
      ) {
        avatarStorageFailed = !updateAvatar(avatarPreview);
      }

      renameAuthoredContent(
        initialProfile.username,
        normalizedProfile.username,
      );

      if (showDepartment !== initialShowDepartment) {
        await updateShowDepartment(showDepartment);

        if (!isCurrentSave(saveGeneration)) {
          return;
        }
      }

      if (avatarStorageFailed) {
        setStatusMessage(
          "Profil bilgilerin kaydedildi; ancak geçici profil fotoğrafı bu cihazda saklanamadı. Tarayıcı depolama alanını kontrol edip yeniden dene.",
        );
        return;
      }

      router.push("/profil");
    } catch (error) {
      if (!isCurrentSave(saveGeneration)) {
        return;
      }

      if (error instanceof AuthClientError) {
        const apiFieldErrors = getApiFieldErrors(error);
        setFieldErrors(apiFieldErrors);
        setStatusMessage(
          profileWasSaved
            ? `Profil bilgilerin kaydedildi; ancak görünürlük tercihi kaydedilemedi. ${error.message}${
                avatarStorageFailed
                  ? " Geçici profil fotoğrafı da bu cihazda saklanamadı."
                  : ""
              }`
            : error.message,
        );

        if (Object.keys(apiFieldErrors).length > 0) {
          focusFirstInvalidField();
        }
      } else {
        setStatusMessage(
          profileWasSaved
            ? `Profil bilgilerin kaydedildi; ancak görünürlük tercihi kaydedilemedi. Lütfen yeniden dene.${
                avatarStorageFailed
                  ? " Geçici profil fotoğrafı da bu cihazda saklanamadı."
                  : ""
              }`
            : "Değişiklikler kaydedilemedi. Bağlantını kontrol edip yeniden dene.",
        );
      }
    } finally {
      if (isCurrentSave(saveGeneration)) {
        setIsSaving(false);
      }
    }
  };

  const availableYearOptions = getCampusYearOptions(department);
  const currentYearOptions = availableYearOptions.includes(year)
    ? availableYearOptions
    : ([year, ...availableYearOptions] as readonly string[]);
  const hasUnlistedDepartment =
    Boolean(department) && !isListedYasarDepartment(department);

  return (
    <section
      aria-labelledby="edit-profile-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-5">
          <Link
            href="/profil"
            aria-label="Profile dön"
            aria-disabled={isSaving}
            tabIndex={isSaving ? -1 : undefined}
            onClick={(event) => {
              if (isSaving) {
                event.preventDefault();
              }
            }}
            className={`grid size-11 shrink-0 place-items-center justify-self-start rounded-full text-white/62 transition-colors hover:bg-white/7 hover:text-white ${
              isSaving ? "pointer-events-none opacity-45" : ""
            } ${focusRing}`}
          >
            <BackIcon />
          </Link>
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
              Profil
            </p>
            <h1
              id="edit-profile-title"
              className="truncate text-base font-black tracking-[-0.03em]"
            >
              Profili düzenle
            </h1>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <form noValidate onSubmit={handleSubmit}>
          <section
            aria-labelledby="profile-photo-title"
            className="border-b border-white/10 pb-7"
          >
            <h2
              id="profile-photo-title"
              className="text-sm font-black tracking-[-0.02em]"
            >
              Profil fotoğrafı
            </h2>

            <div className="mt-4 flex flex-col gap-5 min-[360px]:flex-row min-[360px]:items-center">
              <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-white/12 bg-[#17191c] text-2xl font-black text-[#ff7a45]">
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Yeni profil fotoğrafı önizlemesi"
                    fill
                    sizes="96px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{getInitials(displayName)}</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-col gap-2 min-[420px]:flex-row">
                  <input
                    ref={fileInputRef}
                    id="profile-avatar"
                    name="avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={isProcessingAvatar}
                    onChange={handleAvatarChange}
                    className="peer sr-only"
                    aria-describedby="profile-avatar-help profile-avatar-error"
                  />
                  <label
                    htmlFor="profile-avatar"
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-white/12 px-4 text-xs font-black transition-colors hover:border-[#ff7a45]/32 hover:bg-[#ff7a45]/7 peer-focus-visible:ring-3 peer-focus-visible:ring-[#ff7a45]/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0d16]"
                  >
                    {isProcessingAvatar ? "Hazırlanıyor…" : "Fotoğraf seç"}
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className={`inline-flex min-h-11 items-center justify-center px-4 text-xs font-black text-[#ffb199] transition-colors hover:bg-[#ffb199]/8 ${focusRing}`}
                    >
                      Fotoğrafı kaldır
                    </button>
                  )}
                </div>
                <p
                  id="profile-avatar-help"
                  className="mt-2 text-[11px] leading-5 text-white/55"
                >
                  PNG, JPEG veya WebP · En fazla 2 MB · Kare kırpılır ·
                  Yalnızca bu cihazda geçici saklanır
                </p>
                <p
                  id="profile-avatar-error"
                  role={avatarError ? "alert" : undefined}
                  className="mt-1 min-h-4 text-[11px] font-semibold text-[#ffb199]"
                >
                  {avatarError}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-8 py-7 lg:grid-cols-2 lg:gap-10">
            <section aria-labelledby="identity-title">
              <h2
                id="identity-title"
                className="text-sm font-black tracking-[-0.02em]"
              >
                Profil bilgileri
              </h2>

              <div className="mt-5">
                <label
                  htmlFor="profile-display-name"
                  className="text-xs font-black"
                >
                  Görünen ad
                </label>
                <input
                  id="profile-display-name"
                  name="displayName"
                  type="text"
                  value={displayName}
                  maxLength={40}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.displayName)}
                  aria-describedby="profile-display-name-error"
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    clearFieldError("displayName");
                  }}
                  className={`${fieldClassName} ${
                    fieldErrors.displayName
                      ? "border-[#ffb199]"
                      : ""
                  }`}
                />
                <FieldError
                  id="profile-display-name-error"
                  message={fieldErrors.displayName}
                />
              </div>

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="profile-username"
                    className="text-xs font-black"
                  >
                    Kullanıcı adı
                  </label>
                  <span className="font-mono text-[10px] font-bold text-white/55">
                    {username.length}/24
                  </span>
                </div>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-sm font-black text-white/55"
                  >
                    @
                  </span>
                  <input
                    id="profile-username"
                    name="username"
                    type="text"
                    value={username}
                    minLength={3}
                    maxLength={24}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby="profile-username-help profile-username-error"
                    onChange={(event) => {
                      setUsername(normalizeUsername(event.target.value));
                      clearFieldError("username");
                    }}
                    className={`${fieldClassName} pl-8 ${
                      fieldErrors.username
                        ? "border-[#ffb199]"
                        : ""
                    }`}
                  />
                </div>
                <p
                  id="profile-username-help"
                  className="mt-1.5 text-[11px] leading-5 text-white/55"
                >
                  Küçük harf, rakam, nokta ve alt çizgi kullanabilirsin.
                </p>
                <FieldError
                  id="profile-username-error"
                  message={fieldErrors.username}
                />
              </div>

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="profile-bio"
                    className="text-xs font-black"
                  >
                    Biyografi
                  </label>
                  <span className="font-mono text-[10px] font-bold text-white/55">
                    {bio.length}/160
                  </span>
                </div>
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={bio}
                  maxLength={160}
                  rows={5}
                  aria-invalid={Boolean(fieldErrors.bio)}
                  aria-describedby="profile-bio-error"
                  onChange={(event) => {
                    setBio(event.target.value);
                    clearFieldError("bio");
                  }}
                  placeholder="Kendinden kısaca bahset."
                  className={`${fieldClassName} min-h-32 resize-y leading-6 ${
                    fieldErrors.bio
                      ? "border-[#ffb199]"
                      : ""
                  }`}
                />
                <FieldError
                  id="profile-bio-error"
                  message={fieldErrors.bio}
                />
              </div>
            </section>

            <section aria-labelledby="campus-info-title">
              <h2
                id="campus-info-title"
                className="text-sm font-black tracking-[-0.02em]"
              >
                Kampüs bilgileri
              </h2>

              <div className="mt-5">
                <label
                  htmlFor="profile-department"
                  className="text-xs font-black"
                >
                  Bölüm
                </label>
                <select
                  id="profile-department"
                  name="department"
                  value={department}
                  aria-invalid={Boolean(fieldErrors.department)}
                  aria-describedby="profile-department-error"
                  onChange={(event) => {
                    const nextDepartment = event.target.value;
                    const nextYearOptions =
                      getCampusYearOptions(nextDepartment);

                    setDepartment(nextDepartment);
                    if (!nextYearOptions.includes(year)) {
                      setYear(nextYearOptions[0] ?? "");
                    }
                    clearFieldError("department");
                  }}
                  className={`${fieldClassName} ${
                    fieldErrors.department
                      ? "border-[#ffb199]"
                      : ""
                  }`}
                >
                  {hasUnlistedDepartment && (
                    <optgroup label="Mevcut profil bilgisi">
                      <option value={department}>{department}</option>
                    </optgroup>
                  )}
                  {yasarDepartmentGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.departments.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <FieldError
                  id="profile-department-error"
                  message={fieldErrors.department}
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="profile-year"
                  className="text-xs font-black"
                >
                  Sınıf
                </label>
                <select
                  id="profile-year"
                  name="year"
                  value={year}
                  aria-invalid={Boolean(fieldErrors.year)}
                  aria-describedby="profile-year-error"
                  onChange={(event) => {
                    setYear(event.target.value);
                    clearFieldError("year");
                  }}
                  className={`${fieldClassName} ${
                    fieldErrors.year
                      ? "border-[#ffb199]"
                      : ""
                  }`}
                >
                  {currentYearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="profile-year-error"
                  message={fieldErrors.year}
                />
              </div>

              <label className="mt-6 flex min-h-16 cursor-pointer items-center justify-between gap-4 border border-white/12 px-3.5 py-3">
                <span>
                  <span className="block text-xs font-black">
                    Bölüm ve sınıfı göster
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/55">
                    Bu bilgiler profilinde kullanıcılarla paylaşılır.
                  </span>
                </span>
                <input
                  type="checkbox"
                  name="showDepartment"
                  checked={showDepartment}
                  onChange={(event) => {
                    setShowDepartment(event.target.checked);
                    setStatusMessage("");
                  }}
                  className={`size-5 shrink-0 accent-[#ff7a45] ${focusRing}`}
                />
              </label>

              <div className="mt-6 border-l-2 border-[#ff7a45]/40 pl-3.5">
                <p className="text-[11px] leading-5 text-white/55">
                  Anonim açtığın konular ve anonim yorumların profilinde hiçbir
                  zaman gösterilmez.
                </p>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="min-h-5 text-xs font-semibold text-[#ffb199]"
            >
              {statusMessage}
            </p>

            <div className="flex shrink-0 gap-2">
              <Link
                href="/profil"
                aria-disabled={isSaving}
                tabIndex={isSaving ? -1 : undefined}
                onClick={(event) => {
                  if (isSaving) {
                    event.preventDefault();
                  }
                }}
                className={`inline-flex min-h-11 flex-1 items-center justify-center border border-white/12 px-4 text-xs font-black text-white/62 transition-colors hover:bg-white/6 hover:text-white sm:flex-none ${
                  isSaving ? "pointer-events-none opacity-45" : ""
                } ${focusRing}`}
              >
                Vazgeç
              </Link>
              <button
                type="submit"
                disabled={isSaving || isProcessingAvatar}
                className={`inline-flex min-h-11 flex-1 items-center justify-center bg-white px-5 text-xs font-black text-[#12100e] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${focusRing}`}
              >
                {isSaving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  return (
    <p
      id={id}
      role={message ? "alert" : undefined}
      className="mt-1.5 min-h-4 text-[11px] font-semibold text-[#ffb199]"
    >
      {message}
    </p>
  );
}

function EditProfileLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Profil düzenleme alanı yükleniyor"
      className="min-h-[calc(100svh-4rem)] bg-[#0a0d16] text-white md:min-h-svh"
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-white/12 px-4">
        <div className="size-11 animate-pulse rounded-full bg-white/8 motion-reduce:animate-none" />
        <div className="h-5 w-32 animate-pulse bg-white/8 motion-reduce:animate-none" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="size-24 animate-pulse rounded-full bg-white/8 motion-reduce:animate-none" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse bg-white/6 motion-reduce:animate-none" />
          <div className="h-80 animate-pulse bg-white/6 motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Profil düzenleme alanı yükleniyor…</span>
      </div>
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
      <path d="m14.5 5-7 7 7 7M8 12h10" />
    </svg>
  );
}
