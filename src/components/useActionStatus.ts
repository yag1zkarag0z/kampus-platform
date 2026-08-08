"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ActionStatusTone = "success" | "error";

export type ActionStatus = {
  message: string;
  tone: ActionStatusTone;
  action?: { label: string; onClick: () => void };
} | null;

const DEFAULT_DURATION_MS = 4200;

/**
 * Ekranın bir köşesinde yüzen toast yerine, aksiyonun yanına konan küçük
 * kırmızı/yeşil metin için ortak durum. Süre dolunca kendiliğinden kaybolur.
 */
export function useActionStatus(duration = DEFAULT_DURATION_MS) {
  const [status, setStatusState] = useState<ActionStatus>(null);
  const timeoutRef = useRef<number | null>(null);

  const setStatus = useCallback(
    (next: ActionStatus) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setStatusState(next);

      if (next) {
        timeoutRef.current = window.setTimeout(() => {
          setStatusState(null);
          timeoutRef.current = null;
        }, next.action ? Math.max(duration, 4200) : duration);
      }
    },
    [duration],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return [status, setStatus] as const;
}

export type PendingRemoval<T> = { item: T; index: number } | null;

/**
 * Bir listeden kaldırılan öğeyi, tam olduğu yerde "kaldırıldı, geri al"
 * satırı olarak göstermek için. Köşede yüzen bir "geri al" toast'ı yerine,
 * öğe kayboluyor ama yeri kalıyor.
 */
export function usePendingRemoval<T>(duration = 8000) {
  const [pending, setPendingState] = useState<PendingRemoval<T>>(null);
  const timeoutRef = useRef<number | null>(null);

  const setPending = useCallback(
    (next: PendingRemoval<T>) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setPendingState(next);

      if (next) {
        timeoutRef.current = window.setTimeout(() => {
          setPendingState(null);
          timeoutRef.current = null;
        }, duration);
      }
    },
    [duration],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return [pending, setPending] as const;
}
