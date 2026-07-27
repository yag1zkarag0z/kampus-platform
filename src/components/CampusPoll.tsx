"use client";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import type { CampusPostPoll } from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:focus-visible:ring-[#c7896d]/30";

export default function CampusPoll({
  postId,
  poll,
  compact = false,
}: {
  postId: string;
  poll: CampusPostPoll;
  compact?: boolean;
}) {
  const { isGuest } = useCampusAccount();
  const { voteInPoll } = useCampusData();
  const { showToast } = useFeedback();
  const totalVotes = poll.options.reduce(
    (total, option) => total + option.votes,
    0,
  );
  const hasVoted = Boolean(poll.selectedOptionId);

  return (
    <div
      role="group"
      aria-label="Anket seçenekleri"
      className="mt-4"
    >
      <div className="grid gap-2">
        {poll.options.map((option) => {
          const isSelected = poll.selectedOptionId === option.id;
          const percentage =
            totalVotes > 0
              ? Math.round((option.votes / totalVotes) * 100)
              : 0;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${option.text}, ${percentage} yüzde, ${option.votes} oy`}
              onClick={() => {
                if (isGuest) {
                  showToast({
                    message: "Oy vermek için giriş yap veya kayıt ol.",
                    tone: "info",
                  });
                  return;
                }

                voteInPoll(postId, option.id);
              }}
              className={`relative isolate min-h-12 cursor-pointer overflow-hidden border px-3.5 py-2.5 text-left transition-colors ${focusRing} ${
                isSelected
                  ? "border-[#5a1f32]/42 dark:border-[#c7896d]/48"
                  : "border-[#1c2821]/14 hover:border-[#5a1f32]/28 dark:border-white/12 dark:hover:border-[#c7896d]/30"
              }`}
            >
              {hasVoted && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 -z-10 transition-[width] duration-300 motion-reduce:transition-none ${
                    isSelected
                      ? "bg-[#5a1f32]/13 dark:bg-[#c7896d]/18"
                      : "bg-[#1c2821]/6 dark:bg-white/7"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}
              <span className="flex items-center justify-between gap-3">
                <span
                  className={`font-bold leading-5 ${
                    compact ? "text-xs" : "text-sm"
                  }`}
                >
                  {option.text}
                </span>
                {hasVoted && (
                  <span className="shrink-0 font-mono text-[11px] font-black">
                    %{percentage}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]">
        <span>{totalVotes} oy</span>
        <span>
          {hasVoted
            ? "Seçimini değiştirebilirsin."
            : isGuest
              ? "Oy vermek için giriş yap."
              : "Bir seçenek seçerek oy ver."}
        </span>
      </p>
    </div>
  );
}
