import Image from "next/image";

import {
  avatarPresetUrl,
  avatarPresets,
  type AvatarPresetId,
} from "@/avatar/presets";

export default function AvatarPresetPicker({
  selected,
  onSelect,
  layout = "register",
  disabled = false,
}: {
  selected: AvatarPresetId | null;
  onSelect: (preset: AvatarPresetId) => void;
  layout?: "register" | "profile";
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Hazır avatarlar"
      className={
        layout === "profile"
          ? "mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3"
          : "mt-[16px] grid grid-cols-4 gap-[8px] sm:mt-[24px] sm:gap-[12px] lg:mt-[18px] lg:gap-[10px]"
      }
    >
      {avatarPresets.map((preset) => {
        const isSelected = preset.id === selected;

        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${preset.label} avatarı`}
            disabled={disabled}
            onClick={() => onSelect(preset.id)}
            className={`group relative aspect-square min-w-0 overflow-hidden rounded-[13px] border bg-surface-raised p-[4px] outline-none transition duration-200 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-wait disabled:opacity-55 disabled:hover:translate-y-0 sm:rounded-[16px] sm:p-[6px] ${
              isSelected
                ? "border-brand ring-2 ring-brand/20"
                : "border-white/9 hover:border-white/22"
            }`}
          >
            <Image
              src={avatarPresetUrl(preset.id)}
              alt=""
              width={112}
              height={112}
              unoptimized
              className="size-full rounded-[10px] sm:rounded-[12px]"
            />
            {isSelected && (
              <span
                aria-hidden="true"
                className="absolute right-[5px] top-[5px] grid size-[18px] place-items-center rounded-full bg-brand text-[10px] font-black text-[#101012] shadow-lg sm:right-[8px] sm:top-[8px] sm:size-[20px] sm:text-[11px]"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
