"use client";

import type { ActionStatus } from "@/components/useActionStatus";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

/**
 * Aksiyonun (beğen, şikâyet et, kaydet vb.) hemen yanına konan küçük
 * durum metni — köşede yüzen toast'ın yerini alıyor.
 */
export default function ActionStatusText({
  status,
  className = "",
}: {
  status: ActionStatus;
  className?: string;
}) {
  if (!status) {
    return null;
  }

  return (
    <p
      role={status.tone === "error" ? "alert" : "status"}
      className={`text-xs leading-5 font-bold ${
        status.tone === "error" ? "text-brand" : "text-success"
      } ${className}`}
    >
      {status.message}
      {status.action && (
        <button
          type="button"
          onClick={status.action.onClick}
          className={`ml-1.5 underline underline-offset-2 ${focusRing}`}
        >
          {status.action.label}
        </button>
      )}
    </p>
  );
}
