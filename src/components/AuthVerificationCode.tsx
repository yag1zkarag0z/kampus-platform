"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AuthClientError,
  requestOtpCode,
  verifyOtpCode,
  type OtpPurpose,
} from "@/auth/client";
import type { OtpChallengeResponse } from "@/auth/types";

function secondsUntil(timestamp: number | null, now: number) {
  if (timestamp === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - now) / 1_000));
}

export function formatVerificationTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function useVerificationCode(purpose: OtpPurpose) {
  const [challenge, setChallenge] =
    useState<OtpChallengeResponse | null>(null);
  const [email, setEmail] = useState("");
  const [now, setNow] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const expiresAt = challenge
    ? toTimestamp(challenge.expiresAt)
    : null;
  const resendAvailableAt = challenge
    ? toTimestamp(challenge.resendAvailableAt)
    : null;

  useEffect(() => {
    if (!challenge) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [challenge]);

  const expiresInSeconds = secondsUntil(expiresAt, now);
  const resendInSeconds = secondsUntil(resendAvailableAt, now);
  const attemptsLeft = challenge?.attemptsLeft ?? 3;
  const isExpired = challenge !== null && expiresInSeconds === 0;
  const isLocked = challenge !== null && attemptsLeft === 0;
  const canResend =
    challenge !== null &&
    !isRequesting &&
    !isResending &&
    (isExpired || isLocked || resendInSeconds === 0);

  const applyChallenge = useCallback(
    (nextChallenge: OtpChallengeResponse, nextEmail: string) => {
      if (!mountedRef.current) {
        return;
      }

      setChallenge(nextChallenge);
      setEmail(nextEmail);
      setNow(Date.now());
      setIssueCount((current) => current + 1);
    },
    [],
  );

  const issueCode = useCallback(
    async (nextEmail: string) => {
      setIsRequesting(true);

      try {
        const nextChallenge = await requestOtpCode(
          nextEmail,
          purpose,
        );
        applyChallenge(nextChallenge, nextEmail);
        return nextChallenge;
      } finally {
        if (mountedRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [applyChallenge, purpose],
  );

  const resendCode = useCallback(async () => {
    if (!canResend || !email) {
      return false;
    }

    setIsResending(true);

    try {
      const nextChallenge = await requestOtpCode(email, purpose);
      applyChallenge(nextChallenge, email);
      return true;
    } finally {
      if (mountedRef.current) {
        setIsResending(false);
      }
    }
  }, [applyChallenge, canResend, email, purpose]);

  const verifyCode = useCallback(
    async (code: string) => {
      if (!challenge) {
        throw new AuthClientError(400, {
          code: "OTP_NOT_FOUND",
          message: "Önce e-postana yeni bir kod göndermelisin.",
          fieldErrors: {},
        });
      }

      setIsVerifying(true);

      try {
        return await verifyOtpCode({
          challengeId: challenge.challengeId,
          code,
          purpose,
        });
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          error.attemptsLeft !== undefined &&
          mountedRef.current
        ) {
          setChallenge((current) =>
            current
              ? {
                  ...current,
                  attemptsLeft: error.attemptsLeft ?? 0,
                }
              : current,
          );
        }

        throw error;
      } finally {
        if (mountedRef.current) {
          setIsVerifying(false);
        }
      }
    },
    [challenge, purpose],
  );

  const resetVerification = useCallback(() => {
    setChallenge(null);
    setEmail("");
    setNow(0);
    setIssueCount(0);
    setIsRequesting(false);
    setIsResending(false);
    setIsVerifying(false);
  }, []);

  return useMemo(
    () => ({
      attemptsLeft,
      canResend,
      expiresInSeconds,
      isExpired,
      isLocked,
      isRequesting,
      isResending,
      isVerifying,
      issueCount,
      resendInSeconds,
      issueCode,
      resendCode,
      resetVerification,
      verifyCode,
    }),
    [
      attemptsLeft,
      canResend,
      expiresInSeconds,
      isExpired,
      isLocked,
      isRequesting,
      isResending,
      isVerifying,
      issueCount,
      resendInSeconds,
      issueCode,
      resendCode,
      resetVerification,
      verifyCode,
    ],
  );
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
    ? "Yeni kod e-postana gönderiliyor…"
    : isLocked
      ? "Deneme hakkın doldu. Yeni kod istemelisin."
      : isExpired
        ? "Bu kodun süresi doldu. Yeni kod isteyebilirsin."
        : `${hasFreshCode ? "Yeni kod etkin" : "Kod etkin"} · ${formatVerificationTime(expiresInSeconds)} kaldı`;
  const resendLabel = isResending
    ? "Kod gönderiliyor…"
    : canResend
      ? "Kodu yeniden gönder"
      : `Tekrar gönder (${formatVerificationTime(resendInSeconds)})`;
  const announcementText = isResending
    ? "Yeni doğrulama kodu e-postana gönderiliyor."
    : isLocked
      ? "Doğrulama deneme hakkın doldu. Yeni kod istemelisin."
      : isExpired
        ? "Doğrulama kodunun tahmini süresi doldu. Kodu yine de deneyebilir veya yeni kod isteyebilirsin."
        : issueCount > 1
          ? "Yeni doğrulama kodu e-postana gönderildi."
          : "Doğrulama kodu e-postana gönderildi.";

  return (
    <div className="mt-4 space-y-3">
      <p
        className="sr-only"
        role={isExpired || isLocked ? "alert" : "status"}
        aria-atomic="true"
      >
        {announcementText}
      </p>
      <div
        className={`rounded-xl border px-3 py-2.5 ${
          isExpired || isLocked
            ? "border-[#ffb18c]/24 bg-[#ffb18c]/8 text-[#ffb18c]"
            : "border-white/10 bg-white/4 text-white/55"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p
            className="flex items-center gap-2 text-[11px] font-bold leading-5"
            aria-live="off"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                isExpired || isLocked
                  ? "bg-[#ffb18c]"
                  : "bg-[#7fd9a3]"
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
        className="min-h-11 w-full rounded-xl border border-white/12 px-4 text-xs font-black text-white outline-none transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 disabled:cursor-not-allowed disabled:opacity-48"
      >
        {resendLabel}
      </button>
    </div>
  );
}
