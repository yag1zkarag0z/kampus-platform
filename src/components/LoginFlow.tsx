"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthClientError, startGuestSession } from "@/auth/client";
import {
  useVerificationCode,
  VerificationCodePanel,
} from "@/components/AuthVerificationCode";

type LoginStep = 1 | 2;

const studentEmailPattern = /^\d+@stu\.yasar\.edu\.tr$/i;

const inputClassName =
  "auth-input h-12 w-full rounded-xl border border-white/9 bg-surface px-3.5 text-base text-white outline-none transition placeholder:text-white/32 hover:border-white/18 focus:border-brand focus:ring-3 focus:ring-brand/18";

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
    <div className="mx-auto w-full max-w-[31rem] overflow-hidden rounded-2xl border border-white/9 bg-surface">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <ol className="grid grid-cols-2 gap-2" aria-label="Giriş adımları">
          {["E-posta", "Giriş kodu"].map((label, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < step;

            return (
              <li
                key={label}
                className={`rounded-full border px-3 py-2 text-center text-[10px] font-bold transition-colors ${
                  isCurrent || isDone
                    ? "border-brand/45 bg-brand/10 text-[#ff8968]"
                    : "border-white/8 text-white/35"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-5 py-6 sm:px-6 sm:py-7">
        {sessionNotice && !complete && (
          <div
            role="status"
            className="mb-5 border border-brand/25 bg-brand/9 px-3.5 py-3 text-xs font-bold leading-5 text-[#ff9e80]"
          >
            {sessionNotice}
          </div>
        )}
        {complete ? (
          <div aria-live="polite">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-brand text-[#101012]"
            >
              ✓
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em]">
              Giriş tamamlandı.
            </h2>
            <Link
              href="/akis"
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35"
            >
              Akışa geç
            </Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={submitEmail} noValidate>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              Öğrenci e-postan.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/62">
              E-postana beş dakika geçerli tek kullanımlık bir kod göndereceğiz.
            </p>

            <label
              htmlFor="login-email"
              className="mt-7 block text-xs font-bold"
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
              className={`${inputClassName} mt-2`}
              aria-invalid={message !== null}
              aria-errormessage={message ? "login-message" : undefined}
              aria-describedby="login-message"
              required
            />

            <FormMessage message={message} />

            <button
              type="submit"
              disabled={verification.isRequesting}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-65"
            >
              {verification.isRequesting
                ? "Kod gönderiliyor…"
                : "Giriş kodu gönder"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              Giriş kodu.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/62">
              6 haneli kodu{" "}
              <strong className="font-bold text-white">
                {email}
              </strong>{" "}
              adresi için hazırladık.
            </p>

            <label
              htmlFor="login-code"
              className="mt-7 block text-xs font-bold"
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
              className={`${inputClassName} mt-2 text-center font-mono text-xl font-bold tracking-[0.35em] disabled:cursor-not-allowed disabled:opacity-55`}
              aria-invalid={message !== null}
              aria-errormessage={message ? "login-message" : undefined}
              aria-describedby="login-code-help login-message"
              required
            />
            <p
              id="login-code-help"
              className="mt-2 text-[11px] leading-5 text-white/50"
            >
              Kodu e-postadan kopyalayıp buraya yapıştırabilirsin. Kodunu
              kimseyle paylaşma.
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
              className="mt-5 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-brand px-4 text-sm font-bold text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {verification.isVerifying ? "Doğrulanıyor…" : "Giriş yap"}
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setMessage(null);
                verification.resetVerification();
              }}
              className="mt-3 min-h-11 w-full text-xs font-bold text-white/55 underline decoration-white/20 underline-offset-4"
            >
              E-posta adresini değiştir
            </button>
          </form>
        )}
      </div>

      {!complete && (
        <div className="border-t border-white/8 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              void continueAsGuest();
            }}
            disabled={isOpeningGuestView}
            aria-busy={isOpeningGuestView}
            className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 font-sans text-[16px] font-normal leading-none tracking-normal text-white/68 outline-none transition-colors hover:bg-white/[0.075] hover:text-white focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-60"
          >
            <span>
              {isOpeningGuestView
                ? "Misafir oturumu açılıyor…"
                : "Misafir olarak göz at"}
            </span>
            {!isOpeningGuestView && (
              <span
                aria-hidden="true"
                className="text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70"
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
      className={`text-xs font-medium leading-5 text-danger ${
        message ? "mt-2" : ""
      }`}
    >
      {message}
    </p>
  );
}
