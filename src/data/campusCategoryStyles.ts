import type { CampusPostCategory } from "@/data/campusPosts";

/**
 * Kategori kimliği.
 *
 * Akışta yedi kategori tek turuncu etiketle ayrıldığı için bir itiraf ile bir
 * kayıp eşya ilanı görsel olarak aynı görünüyordu. Her kategori kendi rengini
 * ve işaretini taşır; göz akışı tararken kategoriyi okumadan yakalar.
 */
export const campusCategoryStyles: Record<
  CampusPostCategory,
  { badge: string; dot: string; glyph: string }
> = {
  Sohbet: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#60a5fa]",
    glyph: "💬",
  },
  İtiraf: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#a78bfa]",
    glyph: "🎭",
  },
  Soru: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#fbbf24]",
    glyph: "❓",
  },
  Etkinlik: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#34d399]",
    glyph: "📅",
  },
  "Kayıp Eşya": {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#fb7185]",
    glyph: "🔎",
  },
  Anket: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#818cf8]",
    glyph: "📊",
  },
  İlan: {
    badge: "border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-brand",
    glyph: "🏷️",
  },
};

/** Kategori rozeti için ortak sınıflar. */
export const campusCategoryBadgeBase =
  "inline-flex shrink-0 items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]";
