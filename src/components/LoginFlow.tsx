"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthClientError, startGuestSession } from "@/auth/client";
import {
  useVerificationCode,
  VerificationCodePanel,
} from "@/components/AuthVerificationCode";
import {
  authControlClassName,
  authFlowBodyClassName,
  authFlowCardClassName,
  authFlowFooterClassName,
  authFlowHeaderClassName,
  authGuestButtonClassName,
  authInputClassName,
  authStepDescriptionClassName,
  authStepTitleClassName,
} from "@/components/authFlowLayout";

type LoginStep = 1 | 2;

const studentEmailPattern = /^\d+@stu\.yasar\.edu\.tr$/i;

export default function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [isOpeningGuestView, setIsOpeningGuestView] = useState(false);
  const verification = useVerificationCode("login");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("reason") !== "session-expired") {
      return;
    }

    const noticeTimer = window.setTimeout(
      () =>
        setSessionNotice(
          "Oturum süren doldu. Hesabını korumak için yeniden giriş yapmalısın.",
        ),
      0,
    );

    return () => window.clearTimeout(noticeTimer);
  }, []);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!studentEmailPattern.test(normalizedEmail)) {
      setMessage(
        "Öğrenci numaranla oluşturulan @stu.yasar.edu.tr e-posta adresini kullanmalısın."
      );
      return;
    }

    setEmail(normalizedEmail);
    setMessage(null);

    try {
      await verification.issueCode(normalizedEmail);
      setStep(2);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Giriş kodu gönderilemedi. Lütfen yeniden dene.",
      );
    }
  };

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setMessage("Giriş kodu 6 haneli olmalı.");
      return;
    }

    try {
      await verification.verifyCode(code);
      setMessage(null);
      setComplete(true);
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Giriş tamamlanamadı. Lütfen yeniden dene.",
      );
    }
  };

  const resendCode = async () => {
    try {
      const didResend = await verification.resendCode();

      if (!didResend) {
        return;
      }

      setCode("");
      setMessage(null);
      window.requestAnimationFrame(() => {
        document.getElementById("login-code")?.focus();
      });
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Yeni kod gönderilemedi. Lütfen yeniden dene.",
      );
    }
  };

  const continueAsGuest = async () => {
    if (isOpeningGuestView) {
      return;
    }

    setMessage(null);
    setIsOpeningGuestView(true);

    try {
      await startGuestSession();
      router.push("/akis");
    } catch (error) {
      setMessage(
        error instanceof AuthClientError
          ? error.message
          : "Misafir görünümü şu anda açılamıyor.",
      );
      setIsOpeningGuestView(false);
    }
  };

  return (
    <div className={authFlowCardClassName}>
      <div className={authFlowHeaderClassName}>
        <ol
          className="grid grid-cols-2 gap-[8px] lg:flex lg:justify-center lg:gap-[10px]"
          aria-label="Giriş adımları"
        >
          {["E-posta", "Giriş kodu"].map((label, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < step;

            return (
              <li
                key={label}
                className={`rounded-full border px-[8px] py-[7px] text-center text-[10px] font-bold transition-colors sm:px-[12px] sm:py-[8px] sm:text-[11px] lg:px-[26px] lg:py-[9px] lg:text-[12px] xl:px-[32px] xl:py-[10px] xl:text-[13px] 2xl:text-[14px] ${
                  isCurrent
                    ? "border-brand/50 bg-brand/12 text-[#ff8968]"
                    : isDone
                      ? "border-brand/22 bg-brand/5 text-[#ff8968]/60"
                      : "border-white/10 text-white/52 sm:text-white/48"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className={authFlowBodyClassName}>
        {sessionNotice && !complete && (
          <div
            role="status"
            className="mb-[16px] border border-brand/25 bg-brand/9 px-[14px] py-[12px] text-center text-[12px] font-bold leading-[20px] text-[#ff9e80] lg:text-[14px] lg:leading-[22px]"
          >
            {sessionNotice}
          </div>
        )}
        {complete ? (
          <div aria-live="polite">
            <span
              aria-hidden="true"
              className="grid size-[44px] place-items-center rounded-full bg-brand text-[#101012] lg:mx-auto"
            >
              ✓
            </span>
            <h2 className={`${authStepTitleClassName} mt-[20px]`}>
              Giriş tamamlandı.
            </h2>
            <Link
              href="/akis"
              className="mt-[24px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[16px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[400px] xl:min-h-[56px] xl:w-[500px] xl:text-[17px] 2xl:min-h-[58px] 2xl:w-[520px] 2xl:text-[18px]"
            >
              Akışa geç
            </Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={submitEmail} noValidate>
            <h2 className={authStepTitleClassName}>
              Öğrenci e-postan.
            </h2>
            <p className={authStepDescriptionClassName}>
              <span className="sm:hidden">Tek kullanımlık kodunu gönderelim.</span>
              <span className="hidden sm:inline">
                E-postana beş dakika geçerli tek kullanımlık bir kod göndereceğiz.
              </span>
            </p>

            <label
              htmlFor="login-email"
              className="mt-[22px] block text-[13px] font-bold sm:mt-[28px] lg:mt-[24px] lg:text-center lg:text-[14px] xl:text-[15px] 2xl:text-[16px]"
            >
              Yaşar öğrenci e-postan
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setMessage(null);
              }}
              placeholder="öğrenci.no@stu.yasar.edu.tr"
              className={`${authInputClassName} ${authControlClassName} mt-2`}
              aria-invalid={message !== null}
              aria-errormessage={message ? "login-message" : undefined}
              aria-describedby="login-message"
              required
            />

            <FormMessage message={message} />

            <button
              type="submit"
              disabled={verification.isRequesting}
              className="mt-[16px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[18px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[400px] xl:min-h-[56px] xl:w-[500px] xl:text-[17px] 2xl:min-h-[58px] 2xl:w-[520px] 2xl:text-[18px]"
            >
              {verification.isRequesting
                ? "Kod gönderiliyor…"
                : "Giriş kodu gönder"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <h2 className={authStepTitleClassName}>
              Giriş kodu.
            </h2>
            <p className={`${authStepDescriptionClassName} break-words`}>
              Kod <strong className="font-bold text-white">{email}</strong>
              <span className="hidden sm:inline"> adresi için hazırlandı.</span>
            </p>

            <label
              htmlFor="login-code"
              className="mt-[22px] block text-[13px] font-bold sm:mt-[28px] lg:mt-[24px] lg:text-center lg:text-[14px] xl:text-[15px] 2xl:text-[16px]"
            >
              Giriş kodu
            </label>
            <input
              id="login-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setMessage(null);
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
                setMessage(null);
              }}
              placeholder="000000"
              maxLength={6}
              disabled={
                verification.isLocked ||
                verification.isResending ||
                verification.isVerifying
              }
              className={`${authInputClassName} ${authControlClassName} mt-[8px] text-center font-mono text-[20px] font-bold tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-55 lg:text-[24px]`}
              aria-invalid={message !== null}
              aria-errormessage={message ? "login-message" : undefined}
              aria-describedby="login-code-help login-message"
              required
            />
            <p
              id="login-code-help"
              className="mt-[8px] text-[11px] leading-[18px] text-white/58 lg:text-center lg:text-[13px] lg:leading-[20px]"
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
              inputId="login-code"
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
              className="relative mt-[18px] inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-brand px-[18px] text-[16px] font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[50px] lg:mx-auto lg:flex lg:min-h-[52px] lg:w-[400px] xl:min-h-[56px] xl:w-[500px] xl:text-[17px] 2xl:min-h-[58px] 2xl:w-[520px] 2xl:text-[18px]"
            >
              {verification.isVerifying ? "Doğrulanıyor…" : "Giriş yap"}
              <span aria-hidden="true" className="absolute right-[18px]">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setMessage(null);
                verification.resetVerification();
              }}
              className="mt-[8px] min-h-[40px] w-full text-[12px] font-bold text-white/62 underline decoration-white/20 underline-offset-4 lg:text-[13px]"
            >
              E-posta adresini değiştir
            </button>
          </form>
        )}
      </div>

      {!complete && (
        <div className={authFlowFooterClassName}>
          <button
            type="button"
            onClick={() => {
              void continueAsGuest();
            }}
            disabled={isOpeningGuestView}
            aria-busy={isOpeningGuestView}
            className={authGuestButtonClassName}
          >
            <span>
              {isOpeningGuestView
                ? "Misafir oturumu açılıyor…"
                : "Misafir olarak göz at"}
            </span>
            {!isOpeningGuestView && (
              <span
                aria-hidden="true"
                className="absolute right-[18px] text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70"
              >
                →
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FormMessage({ message }: { message: string | null }) {
  return (
    <p
      id="login-message"
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
