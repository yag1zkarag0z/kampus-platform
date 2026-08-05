"use client";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";

export const quickEmojis = [
  { value: "👍", label: "Beğeni" },
  { value: "❤️", label: "Kalp" },
  { value: "😂", label: "Kahkaha" },
  { value: "🥲", label: "Duygulu yüz" },
  { value: "🎉", label: "Kutlama" },
  { value: "📚", label: "Kitaplar" },
  { value: "📍", label: "Konum" },
  { value: "❓", label: "Soru" },
  { value: "💀", label: "Kuru kafa" },
  { value: "🗿", label: "Moai" },
  { value: "🤡", label: "Palyaço" },
  { value: "🤨", label: "Şüpheli yüz" },
  { value: "😭", label: "Ağlayan yüz" },
  { value: "🫡", label: "Selam veren yüz" },
  { value: "🔥", label: "Ateş" },
  { value: "👀", label: "Gözler" },
] as const;

/** Gönderi, yorum ve yanıt kutularının ortak emoji seçicisi. */
export default function CampusEmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Yorum emojileri"
      className="absolute right-0 bottom-[calc(100%+0.5rem)] z-40 grid w-48 grid-cols-4 gap-1 border border-white/12 bg-[#17191c] p-2 shadow-[0_16px_42px_rgba(0,0,0,0.4)] sm:right-auto sm:left-0"
    >
      {quickEmojis.map((emoji) => (
        <button
          key={emoji.value}
          type="button"
          aria-label={`${emoji.label} emojisini ekle`}
          onClick={() => onSelect(emoji.value)}
          className={`grid size-10 place-items-center rounded-lg text-xl transition-colors hover:bg-[#ff7a45]/10 ${focusRing}`}
        >
          <span aria-hidden="true">{emoji.value}</span>
        </button>
      ))}
    </div>
  );
}
