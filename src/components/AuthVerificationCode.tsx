"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const demoVerificationCode = "135790";

const verificationLifetimeSeconds = 5 * 60;
const resendCooldownSeconds = 30;
const maximumVerificationAttempts = 3;

export type DemoVerificationResult =
  | { status: "valid" }
  | { status: "expired" }
  | { status: "locked" }
  | { status: "incorrect"; attemptsLeft: number };

function secondsUntil(timestamp: number | null, now: number) {
  if (timestamp === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}

export function formatVerificationTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useDemoVerificationCode() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(
    maximumVerificationAttempts,
  );
  const [isResending, setIsResending] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const mountedRef = useRef(true);
  const resendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (expiresAt === null && resendAvailableAt === null) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [expiresAt, resendAvailableAt]);

  const issueCode = useCallback(() => {
    const issuedAt = Date.now();

    setNow(issuedAt);
    setExpiresAt(issuedAt + verificationLifetimeSeconds * 1_000);
    setResendAvailableAt(issuedAt + resendCooldownSeconds * 1_000);
    setAttemptsLeft(maximumVerificationAttempts);
    setIssueCount((current) => current + 1);
  }, []);

  const resetVerification = useCallback(() => {
    setExpiresAt(null);
    setResendAvailableAt(null);
    setNow(0);
    setAttemptsLeft(maximumVerificationAttempts);
    setIsResending(false);
    setIssueCount(0);
    resendingRef.current = false;
  }, []);

  const expiresInSeconds = secondsUntil(expiresAt, now);
  const resendInSeconds = secondsUntil(resendAvailableAt, now);
  const isExpired = expiresAt !== null && expiresInSeconds === 0;
  const isLocked = attemptsLeft === 0;
  const canResend =
    expiresAt !== null && (isExpired || isLocked || resendInSeconds === 0);

  const verifyCode = useCallback(
    (candidate: string): DemoVerificationResult => {
      if (expiresAt === null || Date.now() >= expiresAt) {
        setNow(Date.now());
        return { status: "expired" };
      }

      if (attemptsLeft === 0) {
        return { status: "locked" };
      }

      if (candidate === demoVerificationCode) {
        return { status: "valid" };
      }

      const nextAttemptsLeft = Math.max(0, attemptsLeft - 1);
      setAttemptsLeft(nextAttemptsLeft);

      if (nextAttemptsLeft === 0) {
        return { status: "locked" };
      }

      return {
        status: "incorrect",
        attemptsLeft: nextAttemptsLeft,
      };
    },
    [attemptsLeft, expiresAt],
  );

  const resendCode = useCallback(async () => {
    if (!canResend || resendingRef.current) {
      return false;
    }

    resendingRef.current = true;
    setIsResending(true);

    await new Promise((resolve) => window.setTimeout(resolve, 650));

    if (!mountedRef.current) {
      return false;
    }

    issueCode();
    setIsResending(false);
    resendingRef.current = false;
    return true;
  }, [canResend, issueCode]);

  return {
    attemptsLeft,
    canResend,
    expiresInSeconds,
    isExpired,
    isLocked,
    isResending,
    issueCount,
    resendInSeconds,
    issueCode,
    resendCode,
    resetVerification,
    verifyCode,
  };
}

type VerificationCodePanelProps = {
  attemptsLeft: number;
  canResend: boolean;
  expiresInSeconds: number;
  inputId: string;
  isExpired: boolean;
  isLocked: boolean;
  isResending: boolean;
  issueCount: number;
  resendInSeconds: number;
  onResend: () => void;
};

export function VerificationCodePanel({
  attemptsLeft,
  canResend,
  expiresInSeconds,
  inputId,
  isExpired,
  isLocked,
  isResending,
  issueCount,
  resendInSeconds,
  onResend,
}: VerificationCodePanelProps) {
  const hasFreshCode = issueCount > 1 && !isExpired && !isLocked;
  const statusText = isResending
    ? "Yeni demo kodu hazırlanıyor…"
    : isLocked
      ? "Deneme hakkın doldu. Yeni kod istemelisin."
      : isExpired
        ? "Bu kodun süresi doldu. Yeni kod isteyebilirsin."
        : `${hasFreshCode ? "Yeni kod etkin" : "Kod etkin"} · ${formatVerificationTime(expiresInSeconds)} kaldı`;

  const resendLabel = isResending
    ? "Kod hazırlanıyor…"
    : canResend
      ? "Kodu yeniden gönder"
      : `Tekrar gönder (${formatVerificationTime(resendInSeconds)})`;

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-[#7d3c2d]/18 bg-[#7d3c2d]/6 p-3 dark:border-[#c7896d]/20 dark:bg-[#c7896d]/8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#d09272]">
              Güvenli demo doğrulaması
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[#58635c] dark:text-[#aeb4af]">
              Henüz gerçek e-posta servisi bağlı değil. Bu ekrandaki demo kodunu
              kullan.
            </p>
          </div>
          <code
            className="rounded-lg border border-[#7d3c2d]/18 bg-white/68 px-3 py-2 font-mono text-sm font-black tracking-[0.18em] text-[#5a1f32] dark:border-white/12 dark:bg-black/16 dark:text-[#e0a083]"
            aria-label={`Demo doğrulama kodu: ${demoVerificationCode
              .split("")
              .join(" ")}`}
          >
            {demoVerificationCode}
          </code>
        </div>
      </div>

      <div
        className={`rounded-xl border px-3 py-2.5 ${
          isExpired || isLocked
            ? "border-[#9a3f32]/22 bg-[#9a3f32]/7 text-[#7a2924] dark:border-[#e0a083]/24 dark:bg-[#e0a083]/8 dark:text-[#edb29a]"
            : "border-[#1c2821]/10 bg-white/32 text-[#58635c] dark:border-white/9 dark:bg-white/4 dark:text-[#aeb4af]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p
            className="flex items-center gap-2 text-[11px] font-bold leading-5"
            role={isExpired || isLocked ? "alert" : "status"}
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                isExpired || isLocked
                  ? "bg-[#9a3f32] dark:bg-[#e0a083]"
                  : "bg-[#49725e] dark:bg-[#83af97]"
              }`}
            />
            {statusText}
          </p>
          {!isExpired && !isLocked && (
            <p className="text-[10px] font-bold">
              {attemptsLeft} deneme hakkı
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onResend}
        disabled={!canResend || isResending}
        aria-controls={inputId}
        className="min-h-11 w-full rounded-xl border border-[#1c2821]/13 px-4 text-xs font-black text-[#1c2821] outline-none transition-colors hover:border-[#7d3c2d]/30 hover:bg-[#7d3c2d]/6 focus-visible:ring-3 focus-visible:ring-[#7d3c2d]/20 disabled:cursor-not-allowed disabled:opacity-48 dark:border-white/12 dark:text-[#ece8e1] dark:hover:border-[#c7896d]/35 dark:hover:bg-[#c7896d]/8 dark:focus-visible:ring-[#c7896d]/24"
      >
        {resendLabel}
      </button>
    </div>
  );
}
