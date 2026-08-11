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

import ProductFeedbackDialog from "@/components/ProductFeedbackDialog";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmationRequest = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

type FeedbackContextValue = {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  openFeedback: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | undefined>(
  undefined,
);

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const confirmationRef = useRef<ConfirmationRequest | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        setIsFeedbackOpen(false);
        confirmationRef.current?.resolve(false);
        const request = { ...options, resolve };
        confirmationRef.current = request;
        setConfirmation(request);
      }),
    [],
  );

  const openFeedback = useCallback(() => {
    confirmationRef.current?.resolve(false);
    confirmationRef.current = null;
    setConfirmation(null);
    setIsFeedbackOpen(true);
  }, []);

  const closeConfirmation = useCallback((confirmed: boolean) => {
    const currentRequest = confirmationRef.current;
    confirmationRef.current = null;
    setConfirmation(null);
    currentRequest?.resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
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
    <FeedbackContext.Provider value={{ confirm, openFeedback }}>
      <div inert={confirmation || isFeedbackOpen ? true : undefined}>
        {children}
      </div>

      {isFeedbackOpen && (
        <ProductFeedbackDialog onClose={() => setIsFeedbackOpen(false)} />
      )}

      {confirmation && (
        <div
          className="fixed inset-0 z-[130] grid place-items-end bg-canvas/70 p-3 backdrop-blur-[3px] sm:place-items-center sm:p-6"
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
            className="w-full max-w-md border border-white/12 bg-surface-raised p-5 text-white shadow-[0_24px_64px_rgba(0,0,0,0.36)] sm:p-6"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
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
              className="mt-3 text-sm leading-6 text-white/62"
            >
              {confirmation.description}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => closeConfirmation(false)}
                className={`min-h-11 cursor-pointer border border-white/12 px-4 text-xs font-black hover:bg-white/7 ${focusRing}`}
              >
                {confirmation.cancelLabel ?? "Vazgeç"}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => closeConfirmation(true)}
                className={`min-h-11 cursor-pointer px-4 text-xs font-black ${
                  confirmation.tone === "danger"
                    ? "bg-danger text-[#101012] hover:bg-danger/85"
                    : "bg-white text-[#101012] hover:bg-white/90"
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
