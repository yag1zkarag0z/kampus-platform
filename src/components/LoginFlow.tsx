"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AuthClientError,
  startGuestSession,
} from "@/auth/client";
import {
  useVerificationCode,
  VerificationCodePanel,
} from "@/components/AuthVerificationCode";

type LoginStep = 1 | 2;

const studentEmailPattern = /^[^\s@]+@stu\.yasar\.edu\.tr$/i;

const inputClassName =
  "auth-input h-12 w-full rounded-xl border border-[#1c2821]/14 bg-white/55 px-3.5 text-base text-[#1c2821] outline-none transition placeholder:text-[#68736c] hover:border-[#1c2821]/28 focus:border-[#7d3c2d] focus:ring-3 focus:ring-[#9a5944]/14 dark:border-white/12 dark:bg-white/6 dark:text-[#ece8e1] dark:placeholder:text-[#9ba39d] dark:hover:border-white/24 dark:focus:border-[#c7896d] dark:focus:ring-[#c7896d]/16";

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
        "Yalnızca @stu.yasar.edu.tr uzantılı öğrenci e-postası kullanabilirsin."
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
    <div className="mx-auto w-full max-w-[31rem] overflow-hidden rounded-[1.6rem] border border-[#1c2821]/15 bg-[#fbf8f1]/92 shadow-[0_28px_80px_rgba(42,27,31,0.14)] backdrop-blur-xl dark:border-white/12 dark:bg-[#1a1c20]/94 dark:shadow-[0_28px_80px_rgba(0,0,0,0.36)]">
      <div className="border-b border-[#1c2821]/12 px-5 py-5 dark:border-white/10 sm:px-7">
        <ol className="grid grid-cols-2 gap-2" aria-label="Giriş adımları">
          {["E-posta", "Giriş kodu"].map((label, index) => {
            const number = index + 1;
            const isCurrent = number === step;
            const isDone = number < step;

            return (
              <li
                key={label}
                className={`border-t-2 pt-2 text-[10px] font-bold transition-colors ${
                  isCurrent || isDone
                    ? "border-[#9a5944] text-[#1c2821] dark:border-[#c7896d] dark:text-[#ece8e1]"
                    : "border-[#1c2821]/12 text-[#68736c] dark:border-white/10 dark:text-[#9ba39d]"
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
        {sessionNotice && !complete && (
          <div
            role="status"
            className="mb-5 border border-[#9a5944]/24 bg-[#9a5944]/8 px-3.5 py-3 text-xs font-bold leading-5 text-[#6f3528] dark:border-[#c7896d]/25 dark:bg-[#c7896d]/9 dark:text-[#e3ad91]"
          >
            {sessionNotice}
          </div>
        )}
        {complete ? (
          <div aria-live="polite">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-[#d8d3c8] text-[#3b2028] dark:bg-[#c7896d] dark:text-[#121417]"
            >
              ✓
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.045em]">
              Giriş tamamlandı.
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
              Tekrar hoş geldin.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/62">
              Öğrenci e-postana beş dakika geçerli tek kullanımlık bir kod
              göndereceğiz.
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
              placeholder="202312345@stu.yasar.edu.tr"
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
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              {verification.isRequesting
                ? "Kod gönderiliyor…"
                : "Giriş kodu gönder"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Giriş kodunu yaz.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#1c2821]/64 dark:text-white/62">
              6 haneli kodu{" "}
              <strong className="font-bold text-[#1c2821] dark:text-[#ece8e1]">
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
              className="mt-2 text-[11px] leading-5 text-[#58635c] dark:text-[#aeb4af]"
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
              className="mt-5 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
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
              className="mt-3 min-h-11 w-full text-xs font-bold text-[#58635c] underline decoration-[#1c2821]/22 underline-offset-4 dark:text-[#aeb4af] dark:decoration-white/20"
            >
              E-posta adresini değiştir
            </button>
          </form>
        )}
      </div>

      {!complete && (
        <div className="border-t border-[#1c2821]/10 bg-white/24 px-5 py-4 text-center text-[11px] text-[#58635c] dark:border-white/8 dark:bg-black/8 dark:text-[#aeb4af] sm:px-7">
          <p>
            Hesabın yok mu?{" "}
            <Link
              href="/kayit"
              className="font-bold text-[#7d3c2d] underline decoration-[#9a5944]/30 underline-offset-4 dark:text-[#d09272]"
            >
              Kayıt ol
            </Link>
          </p>
          <button
            type="button"
            onClick={() => {
              void continueAsGuest();
            }}
            disabled={isOpeningGuestView}
            aria-busy={isOpeningGuestView}
            className="mt-3 min-h-11 w-full border border-[#1c2821]/13 px-4 text-xs font-black text-[#1c2821] transition-colors hover:border-[#7d3c2d]/30 hover:bg-[#7d3c2d]/6 dark:border-white/12 dark:text-[#ece8e1] dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/8"
          >
            {isOpeningGuestView
              ? "Misafir görünümü açılıyor…"
              : "Misafir olarak göz at"}
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
      className="mt-4 min-h-5 text-xs font-medium leading-5 text-[#8a2e25] dark:text-[#e0a083]"
    >
      {message}
    </p>
  );
}
