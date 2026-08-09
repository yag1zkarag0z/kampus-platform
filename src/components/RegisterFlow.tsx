"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";

import {
  AuthClientError,
  registerCampusAccount,
  setCurrentAvatarPreset,
} from "@/auth/client";
import {
  avatarPresets,
  type AvatarPresetId,
} from "@/avatar/presets";
import AvatarPresetPicker from "@/components/AvatarPresetPicker";
import {
  useVerificationCode,
  VerificationCodePanel,
} from "@/components/AuthVerificationCode";
import {
  authFlowBodyClassName,
  authFlowCardClassName,
  authFlowHeaderClassName,
  authInputClassName,
  authStepDescriptionClassName,
  authStepTitleClassName,
} from "@/components/authFlowLayout";
import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import {
  getCampusYearOptions,
  yasarDepartmentGroups,
} from "@/data/yasarDepartments";

type RegisterStep = 1 | 2 | 3 | 4;
type RegisterField =
  | "email"
  | "code"
  | "username"
  | "department"
  | "year"
  | "rules";

const studentEmailPattern = /^\d+@stu\.yasar\.edu\.tr$/i;
const helperTextClassName =
  "mt-[8px] text-[11px] leading-[18px] text-white/58 lg:text-center lg:text-[13px] lg:leading-[20px]";

export default function RegisterFlow({
  previewAvatarStep = false,
  previewProfileStep = false,
}: {
  previewAvatarStep?: boolean;
  previewProfileStep?: boolean;
}) {
  const [step, setStep] = useState<RegisterStep>(
    previewAvatarStep ? 4 : previewProfileStep ? 3 : 1,
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [bio, setBio] = useState("");
  const [showDepartment, setShowDepartment] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [registrationToken, setRegistrationToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] =
    useState<RegisterField | null>(null);
  const [complete, setComplete] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarPresetId>(
    avatarPresets[0].id,
  );
  const profileStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const avatarStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const verification = useVerificationCode("registration");
  const availableYearOptions = getCampusYearOptions(department);
  const clearMessage = () => {
    setMessage(null);
    setInvalidField(null);
  };

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      if (step === 3) profileStepHeadingRef.current?.focus();
      if (step === 4) avatarStepHeadingRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [step]);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!studentEmailPattern.test(normalizedEmail)) {
      setMessage(
        "Öğrenci numaranla oluşturulan @stu.yasar.edu.tr e-posta adresini kullanmalısın."
      );
      setInvalidField("email");
      document.getElementById("register-email")?.focus();
      return;
    }

    setEmail(normalizedEmail);
    clearMessage();

    try {
      await verification.issueCode(normalizedEmail);
      setStep(2);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Doğrulama kodu gönderilemedi. Lütfen yeniden dene.",
      );
      setInvalidField("email");
    }
  };

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setMessage("Doğrulama kodu 6 haneli olmalı.");
      setInvalidField("code");
      document.getElementById("register-code")?.focus();
      return;
    }

    try {
      const result = await verification.verifyCode(code);

      if (!("registrationToken" in result)) {
        throw new Error("Registration verification returned no grant.");
      }

      setRegistrationToken(result.registrationToken);
      clearMessage();
      setStep(3);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Kod doğrulanamadı. Lütfen yeniden dene.",
      );
      setInvalidField("code");
      document.getElementById("register-code")?.focus();
    }
  };

  const resendCode = async () => {
    try {
      const didResend = await verification.resendCode();

      if (!didResend) {
        return;
      }

      setRegistrationToken("");
      setCode("");
      clearMessage();
      window.requestAnimationFrame(() => {
        document.getElementById("register-code")?.focus();
      });
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Yeni kod gönderilemedi. Lütfen yeniden dene.",
      );
      setInvalidField("code");
    }
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();

    if (!campusUsernamePattern.test(normalizedUsername)) {
      setMessage(
        "Kullanıcı adı 3–24 karakter olmalı; harf veya rakamla başlayıp bitmeli."
      );
      setInvalidField("username");
      document.getElementById("register-username")?.focus();
      return;
    }

    if (reservedCampusUsernames.has(normalizedUsername)) {
      setMessage("Bu kullanıcı adı KAMPÜS tarafından ayrılmış.");
      setInvalidField("username");
      document.getElementById("register-username")?.focus();
      return;
    }

    if (!department) {
      setMessage("Bölümünü seçmelisin.");
      setInvalidField("department");
      document.getElementById("register-department")?.focus();
      return;
    }

    if (!year) {
      setMessage("Sınıfını seçmelisin.");
      setInvalidField("year");
      document.getElementById("register-year")?.focus();
      return;
    }

    if (!acceptedRules) {
      setMessage("Devam etmek için topluluk kurallarını kabul etmelisin.");
      setInvalidField("rules");
      document.getElementById("register-rules")?.focus();
      return;
    }

    if (!registrationToken) {
      setMessage(
        "Kayıt doğrulaması bulunamadı. E-postanı yeniden doğrulamalısın.",
      );
      setStep(1);
      return;
    }

    setIsRegistering(true);

    try {
      await registerCampusAccount({
        registrationToken,
        username: normalizedUsername,
        displayName,
        department,
        yearLabel: year,
        bio,
        showDepartment,
        termsAccepted: true,
      });

      setUsername(normalizedUsername);
      clearMessage();
      setStep(4);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Hesap oluşturulamadı. Lütfen yeniden dene.",
      );
      setInvalidField(
        error instanceof AuthClientError &&
          error.fieldErrors.username
          ? "username"
          : null,
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const saveAvatar = async () => {
    if (previewAvatarStep) {
      setComplete(true);
      return;
    }

    setIsSavingAvatar(true);
    clearMessage();

    try {
      await setCurrentAvatarPreset(selectedAvatar);
      setComplete(true);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Avatar kaydedilemedi. İstersen şimdilik geçebilirsin.",
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const stepLabels = [
    { full: "E-posta", short: "E-posta" },
    { full: "Doğrulama", short: "Kod" },
    { full: "Profil", short: "Profil" },
    { full: "Avatar", short: "Avatar" },
  ];

  return (
    <div className={authFlowCardClassName}>
      <div className={authFlowHeaderClassName}>
        <ol className="grid grid-cols-4 gap-[6px] sm:gap-[8px]" aria-label="Kayıt adımları">
          {stepLabels.map((label, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < step;

            return (
              <li
                key={label.full}
                className={`min-w-0 rounded-full border px-[5px] py-[7px] text-center text-[10px] font-bold transition-colors sm:px-[8px] sm:py-[8px] sm:text-[11px] lg:px-[12px] lg:py-[10px] lg:text-[12px] ${
                  isCurrent || isDone
                    ? "border-brand/45 bg-brand/10 text-[#ff8968]"
                    : "border-white/8 text-white/48 sm:text-white/35"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="sm:hidden">{label.short}</span>
                <span className="hidden sm:inline">{label.full}</span>
              </li>
            );
          })}
        </ol>
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {step === 3
            ? "Kayıt adımı 3: Kampüs profilini oluştur."
            : step === 4
              ? "Kayıt adımı 4: Avatarını seç."
              : ""}
        </p>
      </div>

      <div className={authFlowBodyClassName}>
        {complete ? (
          <div aria-live="polite">
            <span
              aria-hidden="true"
              className="grid size-[44px] place-items-center rounded-full bg-brand text-[#101012] lg:mx-auto"
            >
              ✓
            </span>
            <h2 className={`${authStepTitleClassName} mt-[20px]`}>
              Aramıza hoş geldin.
            </h2>
            <Link
              href="/akis"
              className="mt-[24px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[16px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[272px]"
            >
              Akışa geç
            </Link>
          </div>
        ) : step === 4 ? (
          <div aria-labelledby="register-avatar-step-title">
            <h2
              ref={avatarStepHeadingRef}
              id="register-avatar-step-title"
              tabIndex={-1}
              className={`${authStepTitleClassName} outline-none`}
            >
              Avatarını seç.
            </h2>
            <p className={`${authStepDescriptionClassName} lg:mt-[8px]`}>
              <span className="sm:hidden">Sonra değiştirebilirsin.</span>
              <span className="hidden sm:inline">
                Seni yansıtan birini seç. Daha sonra profilinden değiştirebilirsin.
              </span>
            </p>

            <AvatarPresetPicker
              selected={selectedAvatar}
              onSelect={(preset) => {
                setSelectedAvatar(preset);
                clearMessage();
              }}
            />

            <FormMessage message={message} />

            <button
              type="button"
              onClick={() => void saveAvatar()}
              disabled={isSavingAvatar}
              className="relative mt-[18px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[16px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65 sm:mx-auto sm:mt-[24px] sm:flex sm:min-h-[50px] sm:w-auto sm:min-w-[210px] sm:px-[22px] lg:mt-[18px] lg:min-h-[52px] lg:w-[272px] lg:min-w-[272px]"
            >
              {isSavingAvatar ? "Kaydediliyor…" : "Bu avatarı kullan"}
              <span aria-hidden="true" className="absolute right-[18px]">→</span>
            </button>

            <button
              type="button"
              onClick={() => setComplete(true)}
              className="mt-[6px] min-h-[40px] w-full text-[12px] font-medium text-white/64 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-brand/30 lg:text-[13px]"
            >
              Geç
            </button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={submitEmail} noValidate>
            <h2 className={authStepTitleClassName}>
              Öğrenci e-postan.
            </h2>
            <p className={authStepDescriptionClassName}>
              <span className="sm:hidden">Öğrenci e-postanla doğrula.</span>
              <span className="hidden sm:inline">
                Katılım yalnızca Yaşar öğrenci e-postasını doğrulayanlara açık.
              </span>
            </p>

            <label
              htmlFor="register-email"
              className="mt-[22px] block text-[13px] font-bold sm:mt-[28px] lg:mt-[24px] lg:text-center lg:text-[14px]"
            >
              Yaşar öğrenci e-postan
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearMessage();
              }}
              placeholder="öğrenci.no@stu.yasar.edu.tr"
              className={`${authInputClassName} mt-2`}
              aria-invalid={invalidField === "email"}
              aria-describedby="register-email-help register-message"
              required
            />
            <FormMessage message={message} />

            <button
              type="submit"
              disabled={verification.isRequesting}
              className="mt-[16px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[18px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[272px]"
            >
              {verification.isRequesting
                ? "Kod gönderiliyor…"
                : "Doğrulama kodu gönder"}
            </button>

            <p
              id="register-email-help"
              className={helperTextClassName}
            >
              E-posta adresin profilinde görünmez.
            </p>
          </form>
        ) : step === 2 ? (
          <form onSubmit={submitCode} noValidate>
            <h2 className={authStepTitleClassName}>
              Doğrulama kodu.
            </h2>
            <p className={`${authStepDescriptionClassName} break-words`}>
              Kod <strong className="font-bold text-white">{email}</strong>
              <span className="hidden sm:inline"> adresi için hazırlandı.</span>
            </p>

            <label
              htmlFor="register-code"
              className="mt-[22px] block text-[13px] font-bold sm:mt-[28px] lg:mt-[24px] lg:text-center lg:text-[14px]"
            >
              Doğrulama kodu
            </label>
            <input
              id="register-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                clearMessage();
              }}
              onPaste={(event) => {
                const pastedCode = event.clipboardData
                  .getData("text")
                  .replace(/\D/g, "")
                  .slice(0, 6);

                if (!pastedCode) {
                  return;
                }

                event.preventDefault();
                setCode(pastedCode);
                clearMessage();
              }}
              placeholder="000000"
              maxLength={6}
              disabled={
                verification.isLocked ||
                verification.isResending ||
                verification.isVerifying
              }
              className={`${authInputClassName} mt-[8px] text-center font-mono text-[20px] font-bold tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-55 lg:text-[24px]`}
              aria-invalid={invalidField === "code"}
              aria-describedby="register-code-help register-message"
              required
            />
            <p
              id="register-code-help"
              className={helperTextClassName}
            >
              <span className="sm:hidden">Kodu e-postadan yapıştır.</span>
              <span className="hidden sm:inline">
                Kodu e-postadan kopyalayıp buraya yapıştırabilirsin. Kodunu
                kimseyle paylaşma.
              </span>
            </p>

            <FormMessage message={message} />

            <VerificationCodePanel
              attemptsLeft={verification.attemptsLeft}
              canResend={verification.canResend}
              expiresInSeconds={verification.expiresInSeconds}
              inputId="register-code"
              isExpired={verification.isExpired}
              isLocked={verification.isLocked}
              isResending={verification.isResending}
              issueCount={verification.issueCount}
              resendInSeconds={verification.resendInSeconds}
              onResend={() => {
                void resendCode();
              }}
            />

            <button
              type="submit"
              disabled={
                verification.isLocked ||
                verification.isResending ||
                verification.isVerifying
              }
              className="relative mt-[18px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[18px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[272px]"
            >
              {verification.isVerifying ? "Doğrulanıyor…" : "Kodu doğrula"}
              <span aria-hidden="true" className="absolute right-[18px]">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setRegistrationToken("");
                clearMessage();
                verification.resetVerification();
              }}
              className="mt-[8px] min-h-[40px] w-full text-[12px] font-bold text-white/62 underline decoration-white/20 underline-offset-4 lg:text-[13px]"
            >
              E-posta adresini değiştir
            </button>
          </form>
        ) : (
          <form
            onSubmit={submitProfile}
            aria-labelledby="register-profile-step-title"
            noValidate
          >
            <h2
              ref={profileStepHeadingRef}
              id="register-profile-step-title"
              tabIndex={-1}
              className={`${authStepTitleClassName} outline-none`}
            >
              Kampüs profilini oluştur.
            </h2>
            <p className={authStepDescriptionClassName}>
              <span className="sm:hidden">Profilini istediğin gibi düzenle.</span>
              <span className="hidden sm:inline">
                Yalnızca kullanıcı adın zorunlu olarak görünür. Diğer profil
                bilgilerini sen yönetirsin.
              </span>
            </p>

            <div className="mt-[18px] grid gap-x-[16px] gap-y-[16px] sm:mt-[24px] sm:grid-cols-2 sm:gap-y-[20px]">
              <div>
                <label
                  htmlFor="register-username"
                  className="block text-[12px] font-bold lg:text-center lg:text-[14px]"
                >
                  Kullanıcı adı
                </label>
                <div className="relative mt-[8px]">
                  <span className="pointer-events-none absolute inset-y-0 left-[14px] flex items-center text-[14px] font-bold text-white/58 lg:left-[18px] lg:text-[17px]">
                    @
                  </span>
                  <input
                    id="register-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value.toLowerCase());
                      clearMessage();
                    }}
                    placeholder="kampuslu35"
                    className={`${authInputClassName} pl-[32px]`}
                    aria-invalid={invalidField === "username"}
                    aria-describedby="register-username-help register-message"
                    required
                  />
                </div>
                <p
                  id="register-username-help"
                  className={helperTextClassName}
                >
                  3–24 karakter; harf, sayı, nokta ve alt çizgi kullanabilirsin.
                </p>
              </div>

              <div>
                <label
                  htmlFor="register-name"
                  className="block text-[12px] font-bold lg:text-center lg:text-[14px]"
                >
                  Görünen adın <span className="font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  id="register-name"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    clearMessage();
                  }}
                  placeholder="Adın veya rumuzun"
                  maxLength={40}
                  className={`${authInputClassName} mt-[8px]`}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="register-department"
                  className="block text-[12px] font-bold lg:text-center lg:text-[14px]"
                >
                  Bölüm
                </label>
                <select
                  id="register-department"
                  name="department"
                  value={department}
                  onChange={(event) => {
                    const nextDepartment = event.target.value;

                    setDepartment(nextDepartment);
                    if (!getCampusYearOptions(nextDepartment).includes(year)) {
                      setYear("");
                    }
                    clearMessage();
                  }}
                  className={`${authInputClassName} mt-[8px] cursor-pointer pr-[36px]`}
                  aria-invalid={invalidField === "department"}
                  aria-describedby="register-department-help register-message"
                  required
                >
                  <option value="" disabled>
                    Bölümünü seç
                  </option>
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
                <p
                  id="register-department-help"
                  className={helperTextClassName}
                >
                  Listede bölümün yoksa “Listede olmayan program” seçeneğini
                  kullanabilirsin.
                </p>
              </div>

              <div>
                <label
                  htmlFor="register-year"
                  className="block text-[12px] font-bold lg:text-center lg:text-[14px]"
                >
                  Sınıf
                </label>
                <select
                  id="register-year"
                  name="year"
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    clearMessage();
                  }}
                  className={`${authInputClassName} mt-[8px] cursor-pointer pr-[36px]`}
                  aria-invalid={invalidField === "year"}
                  aria-describedby="register-message"
                  required
                >
                  <option value="" disabled>
                    Sınıfını seç
                  </option>
                  {availableYearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-start gap-[12px] rounded-[12px] border border-white/12 bg-white/5 p-[12px] text-[12px] leading-[18px] sm:min-h-[80px] lg:p-[14px] lg:text-[14px] lg:leading-[22px]">
                <input
                  type="checkbox"
                  name="showDepartment"
                  checked={showDepartment}
                  onChange={(event) => {
                    setShowDepartment(event.target.checked);
                    clearMessage();
                  }}
                  className="mt-[2px] size-[16px] shrink-0 accent-brand outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
                />
                <span>
                  <span className="block font-bold">
                    Bölüm ve sınıfımı göster
                  </span>
                  <span className="mt-[4px] block text-white/58">
                    İstersen daha sonra ayarlardan değiştirebilirsin.
                  </span>
                </span>
              </label>

              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between gap-[12px]">
                  <label
                    htmlFor="register-bio"
                    className="block text-[12px] font-bold lg:text-center lg:text-[14px]"
                  >
                    Biyografi{" "}
                    <span className="font-normal">(isteğe bağlı)</span>
                  </label>
                  <span className="font-mono text-[10px] font-bold text-white/50 lg:text-[12px]">
                    {bio.length}/160
                  </span>
                </div>
                <textarea
                  id="register-bio"
                  name="bio"
                  value={bio}
                  onChange={(event) => {
                    setBio(event.target.value);
                    clearMessage();
                  }}
                  placeholder="Kendinden veya kampüste ilgilendiğin şeylerden kısaca bahset."
                  maxLength={160}
                  rows={4}
                  className={`${authInputClassName} mt-[8px] h-auto min-h-[88px] resize-y py-[10px] leading-[22px] sm:min-h-[112px] sm:py-[12px]`}
                />
              </div>
            </div>

            <div className="mt-[20px] flex items-start gap-[12px] rounded-[12px] border border-white/12 bg-white/5 p-[12px] text-[12px] leading-[18px] sm:mt-[24px] lg:p-[14px] lg:text-[14px] lg:leading-[22px]">
              <input
                id="register-rules"
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => {
                  setAcceptedRules(event.target.checked);
                  clearMessage();
                }}
                required
                aria-invalid={invalidField === "rules"}
                aria-describedby="register-message"
                className="mt-[2px] size-[16px] shrink-0 accent-brand outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
              />
              <div>
                <label
                  htmlFor="register-rules"
                  className="cursor-pointer font-bold"
                >
                  Kullanım ve Topluluk Sözleşmesi’ni okudum ve kabul
                  ediyorum.
                </label>
                <Link
                  href="/sozlesme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[4px] block w-fit font-bold text-brand underline decoration-brand/35 underline-offset-4 outline-none hover:text-[#ff9e80] focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Sözleşmeyi oku
                  <span className="sr-only"> (yeni sekmede açılır)</span>
                  <span aria-hidden="true"> ↗</span>
                </Link>
              </div>
            </div>

            <FormMessage message={message} />

            <button
              type="submit"
              disabled={isRegistering}
              className="relative mt-[20px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[18px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65 sm:mt-[24px] sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[272px]"
            >
              {isRegistering ? "Hesap oluşturuluyor…" : "Kaydı tamamla"}
              <span aria-hidden="true" className="absolute right-[18px]">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRegistrationToken("");
                setCode("");
                clearMessage();
                verification.resetVerification();
                setStep(1);
              }}
              className="mt-[8px] min-h-[40px] w-full text-[12px] font-bold text-white/62 underline decoration-white/20 underline-offset-4 lg:text-[13px]"
            >
              E-posta doğrulamasını yeniden başlat
            </button>
          </form>
        )}
      </div>

      {!complete && step !== 4 && (
        <div className="hidden border-t border-white/8 bg-surface-raised px-[24px] py-[16px] text-center text-white/62 sm:flex sm:items-center sm:justify-center lg:min-h-[84px] lg:text-[13px]">
          Zaten hesabın var mı?{" "}
          <Link
            href="/giris"
            className="font-bold text-brand underline decoration-brand/35 underline-offset-4"
          >
            Giriş yap
          </Link>
        </div>
      )}
    </div>
  );
}

function FormMessage({ message }: { message: string | null }) {
  return (
    <p
      id="register-message"
      role={message ? "alert" : "status"}
      aria-live={message ? "assertive" : "polite"}
      className={`text-[12px] font-medium leading-[20px] text-danger lg:text-center lg:text-[13px] ${
        message ? "mt-2" : ""
      }`}
    >
      {message}
    </p>
  );
}
