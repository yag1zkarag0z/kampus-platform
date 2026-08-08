"use client";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import { useActionStatus } from "@/components/useActionStatus";
import type { CampusPostPoll } from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

export default function CampusPoll({
  postId,
  poll,
  compact = false,
  onVote,
}: {
  postId: string;
  poll: CampusPostPoll;
  compact?: boolean;
  onVote?: (optionId: string) => void;
}) {
  const { isGuest } = useCampusAccount();
  const { voteInPoll } = useCampusData();
  const [voteStatus, setVoteStatus] = useActionStatus();
  const submitVote =
    onVote ?? ((optionId: string) => voteInPoll(postId, optionId));
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
                  setVoteStatus({
                    message: "Oy vermek için giriş yap veya kayıt ol.",
                    tone: "error",
                  });
                  return;
                }

                submitVote(option.id);
              }}
              className={`relative isolate min-h-12 cursor-pointer overflow-hidden border px-3.5 py-2.5 text-left transition-colors ${focusRing} ${
                isSelected
                  ? "border-brand/48"
                  : "border-white/12 hover:border-brand/30"
              }`}
            >
              {hasVoted && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 -z-10 transition-[width] duration-300 motion-reduce:transition-none ${
                    isSelected
                      ? "bg-brand/18"
                      : "bg-white/7"
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

      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-white/55">
        <span>{totalVotes} oy</span>
        <span>
          {hasVoted
            ? "Seçimini değiştirebilirsin."
            : isGuest
              ? "Oy vermek için giriş yap."
              : "Bir seçenek seçerek oy ver."}
        </span>
      </p>

      {voteStatus && <ActionStatusText status={voteStatus} className="mt-2" />}
    </div>
  );
}
