"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { persistRegisteredCampusAccount } from "@/components/CampusAccountProvider";
import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import {
  getCampusYearOptions,
  yasarDepartmentGroups,
} from "@/data/yasarDepartments";

type RegisterStep = 1 | 2 | 3;
type RegisterField =
  | "email"
  | "code"
  | "username"
  | "department"
  | "year"
  | "rules";

const studentEmailPattern = /^[^\s@]+@stu\.yasar\.edu\.tr$/i;
const inputClassName =
  "auth-input h-12 w-full rounded-xl border border-[#1c2821]/14 bg-white/55 px-3.5 text-base text-[#1c2821] outline-none transition placeholder:text-[#68736c] hover:border-[#1c2821]/28 focus:border-[#7d3c2d] focus:ring-3 focus:ring-[#9a5944]/14 dark:border-white/12 dark:bg-white/6 dark:text-[#ece8e1] dark:placeholder:text-[#9ba39d] dark:hover:border-white/24 dark:focus:border-[#c7896d] dark:focus:ring-[#c7896d]/16";
const helperTextClassName =
  "mt-2 text-[11px] leading-5 text-[#58635c] dark:text-[#aeb4af]";

export default function RegisterFlow() {
  const [step, setStep] = useState<RegisterStep>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [bio, setBio] = useState("");
  const [showDepartment, setShowDepartment] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] =
    useState<RegisterField | null>(null);
  const [complete, setComplete] = useState(false);
  const availableYearOptions = getCampusYearOptions(department);
  const clearMessage = () => {
    setMessage(null);
    setInvalidField(null);
  };

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!studentEmailPattern.test(normalizedEmail)) {
      setMessage(
        "Yalnızca @stu.yasar.edu.tr uzantılı öğrenci e-postası kullanabilirsin."
      );
      setInvalidField("email");
      document.getElementById("register-email")?.focus();
      return;
    }

    setEmail(normalizedEmail);
    clearMessage();
    setStep(2);
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setMessage("Doğrulama kodu 6 haneli olmalı.");
      setInvalidField("code");
      document.getElementById("register-code")?.focus();
      return;
    }

    clearMessage();
    setStep(3);
  };

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
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

    if (
      !persistRegisteredCampusAccount({
        username: normalizedUsername,
        displayName,
        department,
        year,
        bio,
        showDepartment,
      })
    ) {
      setMessage(
        "Profil bu tarayıcıya kaydedilemedi. Depolama iznini kontrol edip yeniden dene.",
      );
      setInvalidField(null);
      return;
    }

    setUsername(normalizedUsername);
    clearMessage();
    setComplete(true);
  };

  const stepLabels = ["E-posta", "Doğrulama", "Profil"];

  return (
    <div className="mx-auto w-full max-w-[31rem] overflow-hidden rounded-[1.6rem] border border-[#1c2821]/15 bg-[#fbf8f1]/92 shadow-[0_28px_80px_rgba(42,27,31,0.14)] backdrop-blur-xl dark:border-white/12 dark:bg-[#1a1c20]/94 dark:shadow-[0_28px_80px_rgba(0,0,0,0.36)]">
      <div className="border-b border-[#1c2821]/12 px-5 py-5 dark:border-white/10 sm:px-7">
        <ol className="grid grid-cols-3 gap-2" aria-label="Kayıt adımları">
          {stepLabels.map((label, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < step;

            return (
              <li
                key={label}
                className={`border-t-2 pt-2 text-[10px] font-bold transition-colors ${
                  isCurrent || isDone
                    ? "border-[#9a5944] text-[#1c2821] dark:border-[#c7896d] dark:text-[#ece8e1]"
                    : "border-[#1c2821]/12 text-[#58635c] dark:border-white/10 dark:text-[#aeb4af]"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-5 py-6 sm:px-7 sm:py-7">
        {complete ? (
          <div aria-live="polite">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-[#d8d3c8] text-[#3b2028] dark:bg-[#c7896d] dark:text-[#121417]"
            >
              ✓
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.045em]">
              Aramıza hoş geldin.
            </h2>
            <Link
              href="/akis"
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              Akışa geç
            </Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={submitEmail} noValidate>
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Öğrenci e-postanla başlayalım.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/62">
              Katılım yalnızca Yaşar öğrenci e-postasını doğrulayanlara açık.
            </p>

            <label
              htmlFor="register-email"
              className="mt-7 block text-xs font-bold"
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
              placeholder="ad.soyad@stu.yasar.edu.tr"
              className={`${inputClassName} mt-2`}
              aria-invalid={invalidField === "email"}
              aria-describedby="register-email-help register-message"
              required
            />
            <p
              id="register-email-help"
              className={helperTextClassName}
            >
              E-posta adresin profilinde görünmez.
            </p>

            <FormMessage message={message} />

            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53] dark:focus-visible:ring-[#c7896d]/30"
            >
              Doğrulama kodu gönder
              <span aria-hidden="true">→</span>
            </button>
          </form>
        ) : step === 2 ? (
          <form onSubmit={submitCode} noValidate>
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Kod e-postanda.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/62">
              6 haneli doğrulama kodunu{" "}
              <strong className="font-bold text-[#1c2821] dark:text-[#ece8e1]">
                {email}
              </strong>{" "}
              adresine gönderdik.
            </p>

            <label
              htmlFor="register-code"
              className="mt-7 block text-xs font-bold"
            >
              Doğrulama kodu
            </label>
            <input
              id="register-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                clearMessage();
              }}
              placeholder="000000"
              maxLength={6}
              className={`${inputClassName} mt-2 text-center font-mono text-xl font-bold tracking-[0.35em]`}
              aria-invalid={invalidField === "code"}
              aria-describedby="register-code-help register-message"
              required
            />
            <p
              id="register-code-help"
              className={helperTextClassName}
            >
              Kodunu kimseyle paylaşma. KAMPÜS senden kodunu istemez.
            </p>

            <FormMessage message={message} />

            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              Kodu doğrula
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                clearMessage();
              }}
              className="mt-3 min-h-11 w-full text-xs font-bold text-[#1c2821]/62 underline decoration-[#1c2821]/22 underline-offset-4 dark:text-white/58 dark:decoration-white/20"
            >
              E-posta adresini değiştir
            </button>
          </form>
        ) : (
          <form onSubmit={submitProfile} noValidate>
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Kampüs profilini oluştur.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/62">
              Yalnızca kullanıcı adın zorunlu olarak görünür. Diğer profil
              bilgilerini sen yönetirsin.
            </p>

            <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="register-username"
                  className="block text-xs font-bold"
                >
                  Kullanıcı adı
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-bold text-[#58635c] dark:text-[#aeb4af]">
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
                    className={`${inputClassName} pl-8`}
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
                  className="block text-xs font-bold"
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
                  className={`${inputClassName} mt-2`}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="register-department"
                  className="block text-xs font-bold"
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
                  className={`${inputClassName} mt-2 cursor-pointer pr-9`}
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
                  className="block text-xs font-bold"
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
                  className={`${inputClassName} mt-2 cursor-pointer pr-9`}
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

              <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-[#1c2821]/12 bg-white/35 p-3 text-xs leading-5 dark:border-white/10 dark:bg-white/4">
                <input
                  type="checkbox"
                  name="showDepartment"
                  checked={showDepartment}
                  onChange={(event) => {
                    setShowDepartment(event.target.checked);
                    clearMessage();
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[#7d3c2d] outline-none focus-visible:ring-3 focus-visible:ring-[#7d3c2d]/25 dark:accent-[#c7896d] dark:focus-visible:ring-[#c7896d]/30"
                />
                <span>
                  <span className="block font-bold">
                    Bölüm ve sınıfımı göster
                  </span>
                  <span className="mt-1 block text-[#58635c] dark:text-[#aeb4af]">
                    İstersen daha sonra ayarlardan değiştirebilirsin.
                  </span>
                </span>
              </label>

              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="register-bio"
                    className="block text-xs font-bold"
                  >
                    Biyografi{" "}
                    <span className="font-normal">(isteğe bağlı)</span>
                  </label>
                  <span className="font-mono text-[10px] font-bold text-[#58635c] dark:text-[#aeb4af]">
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
                  className={`${inputClassName} mt-2 h-auto min-h-28 resize-y py-3 leading-6`}
                />
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#1c2821]/12 bg-white/35 p-3 text-xs leading-5 dark:border-white/10 dark:bg-white/4">
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
                className="mt-0.5 size-4 shrink-0 accent-[#7d3c2d] outline-none focus-visible:ring-3 focus-visible:ring-[#7d3c2d]/25 dark:accent-[#c7896d] dark:focus-visible:ring-[#c7896d]/30"
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
                  className="mt-1 block w-fit font-bold text-[#7d3c2d] underline decoration-[#9a5944]/35 underline-offset-4 outline-none hover:text-[#5a1f32] focus-visible:ring-2 focus-visible:ring-[#7d3c2d]/25 dark:text-[#d09272] dark:hover:text-[#e0a083] dark:focus-visible:ring-[#c7896d]/30"
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
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              Kaydı tamamla
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(2);
                clearMessage();
              }}
              className="mt-3 min-h-11 w-full text-xs font-bold text-[#1c2821]/62 underline decoration-[#1c2821]/22 underline-offset-4 dark:text-white/58 dark:decoration-white/20"
            >
              Önceki adıma dön
            </button>
          </form>
        )}
      </div>

      {!complete && (
        <div className="border-t border-[#1c2821]/10 bg-white/24 px-5 py-4 text-center text-[11px] text-[#58635c] dark:border-white/8 dark:bg-black/8 dark:text-[#aeb4af] sm:px-7">
          Zaten hesabın var mı?{" "}
          <Link
            href="/giris"
            className="font-bold text-[#7d3c2d] underline decoration-[#9a5944]/30 underline-offset-4 dark:text-[#d09272]"
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
      role="status"
      aria-live="polite"
      className="mt-4 min-h-5 text-xs font-medium leading-5 text-[#8a2e25] dark:text-[#e0a083]"
    >
      {message}
    </p>
  );
}
