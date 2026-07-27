"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { activateCampusSession } from "@/components/CampusAccountProvider";

type LoginStep = 1 | 2;

const studentEmailPattern = /^[^\s@]+@stu\.yasar\.edu\.tr$/i;

const inputClassName =
  "auth-input h-12 w-full rounded-xl border border-[#1c2821]/14 bg-white/55 px-3.5 text-base text-[#1c2821] outline-none transition placeholder:text-[#1c2821]/38 hover:border-[#1c2821]/28 focus:border-[#7d3c2d] focus:ring-3 focus:ring-[#9a5944]/14 dark:border-white/12 dark:bg-white/6 dark:text-[#ece8e1] dark:placeholder:text-white/34 dark:hover:border-white/24 dark:focus:border-[#c7896d] dark:focus:ring-[#c7896d]/16";

export default function LoginFlow() {
  const [step, setStep] = useState<LoginStep>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
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
    setStep(2);
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setMessage("Giriş kodu 6 haneli olmalı.");
      return;
    }

    if (!activateCampusSession()) {
      setMessage("Oturum bu tarayıcıda başlatılamadı. Yeniden deneyebilirsin.");
      return;
    }

    setMessage(null);
    setComplete(true);
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
                    : "border-[#1c2821]/12 text-[#1c2821]/42 dark:border-white/10 dark:text-white/38"
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
              Öğrenci e-postana tek kullanımlık giriş kodu göndereceğiz.
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
              placeholder="ad.soyad@stu.yasar.edu.tr"
              className={`${inputClassName} mt-2`}
              aria-describedby="login-message"
              required
            />

            <FormMessage message={message} />

            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              Giriş kodu gönder
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
              adresine gönderdik.
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
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setMessage(null);
              }}
              placeholder="000000"
              maxLength={6}
              className={`${inputClassName} mt-2 text-center font-mono text-xl font-bold tracking-[0.35em]`}
              aria-describedby="login-code-help login-message"
              required
            />
            <p
              id="login-code-help"
              className="mt-2 text-[11px] leading-5 text-[#1c2821]/54 dark:text-white/50"
            >
              Kodunu kimseyle paylaşma. KAMPÜS senden kodunu istemez.
            </p>

            <FormMessage message={message} />

            <button
              type="submit"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#5a1f32] px-4 text-sm font-bold text-[#fffaf4] outline-none transition-colors hover:bg-[#6b2940] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:bg-[#9a5944] dark:hover:bg-[#ad6b53]"
            >
              Giriş yap
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setMessage(null);
              }}
              className="mt-3 min-h-11 w-full text-xs font-bold text-[#1c2821]/62 underline decoration-[#1c2821]/22 underline-offset-4 dark:text-white/58 dark:decoration-white/20"
            >
              E-posta adresini değiştir
            </button>
          </form>
        )}
      </div>

      {!complete && (
        <div className="border-t border-[#1c2821]/10 bg-white/24 px-5 py-4 text-center text-[11px] text-[#1c2821]/58 dark:border-white/8 dark:bg-black/8 dark:text-white/52 sm:px-7">
          Hesabın yok mu?{" "}
          <Link
            href="/kayit"
            className="font-bold text-[#7d3c2d] underline decoration-[#9a5944]/30 underline-offset-4 dark:text-[#d09272]"
          >
            Kayıt ol
          </Link>
        </div>
      )}
    </div>
  );
}

function FormMessage({ message }: { message: string | null }) {
  return (
    <p
      id="login-message"
      role="status"
      aria-live="polite"
      className="mt-4 min-h-5 text-xs font-medium leading-5 text-[#8a2e25] dark:text-[#e0a083]"
    >
      {message}
    </p>
  );
}
