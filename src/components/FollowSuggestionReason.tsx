"use client";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import {
  describeSuggestionReason,
  resolveSuggestionReason,
  type SuggestionEntry,
} from "@/components/followSuggestionEntry";

/**
 * "Neden bu kişi" satırı. Ad ve kullanıcı adı tek başına karar verdirmiyordu;
 * ortak takip ya da bölüm bilgisi listeyi rastgele isimler yığını olmaktan
 * çıkarıyor.
 */
export default function FollowSuggestionReason({
  entry,
  className = "",
  wrap = false,
}: {
  entry: SuggestionEntry;
  className?: string;
  /** Dar kartta tek satıra sığmayan gerekçe kırpılmak yerine ikiye bölünür. */
  wrap?: boolean;
}) {
  const reason = resolveSuggestionReason(entry);

  if (!reason) {
    return null;
  }

  const text = describeSuggestionReason(reason);

  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-white/42 ${className}`}
    >
      {reason.kind === "mutual" && reason.names.length > 0 ? (
        <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
          {reason.names.map((name) => (
            <CampusAuthorAvatar
              key={name}
              author={name}
              authorId={name}
              size="sm"
              className="size-[18px] text-[8px] ring-2 ring-canvas"
            />
          ))}
        </span>
      ) : (
        <ReasonGlyph kind={reason.kind} />
      )}
      <span className={wrap ? "line-clamp-2 leading-4" : "truncate"}>
        {text}
      </span>
    </span>
  );
}

function ReasonGlyph({ kind }: { kind: "department" | "new" | "popular" | "mutual" }) {
  if (kind === "new") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="size-3.5 shrink-0"
      >
        <path d="M10 3.2c.5 2.8 2.1 4.4 4.9 4.9-2.8.5-4.4 2.1-4.9 4.9-.5-2.8-2.1-4.4-4.9-4.9C7.9 7.6 9.5 6 10 3.2Z" />
      </svg>
    );
  }

  if (kind === "popular") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 shrink-0"
      >
        <path d="M3 13.2 7.4 8.6l2.9 2.6L16.8 5" />
        <path d="M12.9 5h3.9v3.8" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
    >
      <path d="M10 3 2.8 6.4 10 9.8l7.2-3.4L10 3Z" />
      <path d="M5.6 8.2v4.1c0 1.2 2 2.2 4.4 2.2s4.4-1 4.4-2.2V8.2" />
    </svg>
  );
}
