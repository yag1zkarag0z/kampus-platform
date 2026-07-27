"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
};

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ToastItem = Required<Pick<ToastOptions, "message" | "tone">> &
  Pick<ToastOptions, "action"> & {
    id: number;
  };

type ConfirmationRequest = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

type FeedbackContextValue = {
  showToast: (options: ToastOptions) => void;
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | undefined>(
  undefined,
);

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/28 dark:focus-visible:ring-[#c7896d]/38";

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const nextToastId = useRef(0);
  const toastTimeouts = useRef(new Map<number, number>());
  const confirmationRef = useRef<ConfirmationRequest | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const dismissToast = useCallback((toastId: number) => {
    const timeoutId = toastTimeouts.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeouts.current.delete(toastId);
    }
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }, []);

  const showToast = useCallback(
    ({
      message,
      tone = "info",
      action,
      duration,
    }: ToastOptions) => {
      const id = ++nextToastId.current;
      const timeoutDuration = duration ?? (action ? 8000 : 4200);
      setToasts((currentToasts) => [
        ...currentToasts.slice(-2),
        { id, message, tone, action },
      ]);

      const timeoutId = window.setTimeout(
        () => dismissToast(id),
        timeoutDuration,
      );
      toastTimeouts.current.set(id, timeoutId);
    },
    [dismissToast],
  );

  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        confirmationRef.current?.resolve(false);
        const request = { ...options, resolve };
        confirmationRef.current = request;
        setConfirmation(request);
      }),
    [],
  );

  const closeConfirmation = useCallback((confirmed: boolean) => {
    const currentRequest = confirmationRef.current;
    confirmationRef.current = null;
    setConfirmation(null);
    currentRequest?.resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
      toastTimeouts.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      confirmationRef.current?.resolve(false);
    },
    [],
  );

  useEffect(() => {
    if (!confirmation) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = requestAnimationFrame(() =>
      confirmButtonRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [closeConfirmation, confirmation]);

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      <div inert={confirmation ? true : undefined}>{children}</div>

      <div
        aria-label="Bildirimler"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[120] grid justify-items-end gap-2 md:inset-x-auto md:right-5 md:bottom-5 md:w-[min(24rem,calc(100vw-2.5rem))]"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full items-center gap-3 border border-[#1c2821]/14 bg-[#fffaf4]/98 px-3 py-3 text-[#1c2821] shadow-[0_18px_55px_rgba(28,40,33,0.18)] backdrop-blur-xl dark:border-white/13 dark:bg-[#202226]/98 dark:text-[#ece8e1] dark:shadow-[0_18px_55px_rgba(0,0,0,0.42)]"
          >
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${
                toast.tone === "success"
                  ? "bg-[#52735a]"
                  : toast.tone === "error"
                    ? "bg-[#b34d42]"
                    : "bg-[#d46a2f]"
              }`}
            />
            <p className="min-w-0 flex-1 text-xs font-bold leading-5">
              {toast.message}
            </p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast(toast.id);
                }}
                className={`min-h-10 shrink-0 cursor-pointer px-2 text-xs font-black text-[#7d3c2d] dark:text-[#d09272] ${focusRing}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Bildirimi kapat"
              onClick={() => dismissToast(toast.id)}
              className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-lg text-[#1c2821]/48 hover:bg-[#1c2821]/7 hover:text-[#1c2821] dark:text-white/46 dark:hover:bg-white/8 dark:hover:text-white ${focusRing}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>

      {confirmation && (
        <div
          className="fixed inset-0 z-[130] grid place-items-end bg-[#101512]/62 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-confirmation-title"
            aria-describedby="shared-confirmation-description"
            className="w-full max-w-md border border-[#1c2821]/14 bg-[#fbf8f1] p-5 text-[#1c2821] shadow-[0_28px_90px_rgba(15,18,16,0.32)] dark:border-white/13 dark:bg-[#202226] dark:text-[#ece8e1] sm:p-6"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#d09272]">
              Onay gerekiyor
            </p>
            <h2
              id="shared-confirmation-title"
              className="mt-2 text-xl font-black tracking-[-0.04em]"
            >
              {confirmation.title}
            </h2>
            <p
              id="shared-confirmation-description"
              className="mt-3 text-sm leading-6 text-[#1c2821]/66 dark:text-white/62"
            >
              {confirmation.description}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => closeConfirmation(false)}
                className={`min-h-11 cursor-pointer border border-[#1c2821]/14 px-4 text-xs font-black hover:bg-[#1c2821]/6 dark:border-white/12 dark:hover:bg-white/7 ${focusRing}`}
              >
                {confirmation.cancelLabel ?? "Vazgeç"}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => closeConfirmation(true)}
                className={`min-h-11 cursor-pointer px-4 text-xs font-black ${
                  confirmation.tone === "danger"
                    ? "bg-[#8b2f2a] text-white hover:bg-[#752620] dark:bg-[#d27368] dark:text-[#17191c] dark:hover:bg-[#df8277]"
                    : "bg-[#1c2821] text-white hover:bg-[#5a1f32] dark:bg-[#c7896d] dark:text-[#17191c] dark:hover:bg-[#d09272]"
                } ${focusRing}`}
              >
                {confirmation.confirmLabel ?? "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider.");
  }

  return context;
}
