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
    badge: "border-[#7fb7d9]/45 bg-[#7fb7d9]/12 text-[#a8d2ec]",
    dot: "bg-[#7fb7d9]",
    glyph: "💬",
  },
  İtiraf: {
    badge: "border-[#b79ae0]/45 bg-[#b79ae0]/12 text-[#d3c1f0]",
    dot: "bg-[#b79ae0]",
    glyph: "🎭",
  },
  Soru: {
    badge: "border-[#c7a96d]/45 bg-[#c7a96d]/12 text-[#e3cf9c]",
    dot: "bg-[#c7a96d]",
    glyph: "❓",
  },
  Etkinlik: {
    badge: "border-[#8fba9b]/45 bg-[#8fba9b]/12 text-[#b5d8bd]",
    dot: "bg-[#8fba9b]",
    glyph: "📅",
  },
  "Kayıp Eşya": {
    badge: "border-[#e0a083]/45 bg-[#e0a083]/12 text-[#f0c5b1]",
    dot: "bg-[#e0a083]",
    glyph: "🔎",
  },
  Anket: {
    badge: "border-[#9aa8d3]/45 bg-[#9aa8d3]/12 text-[#c4cce8]",
    dot: "bg-[#9aa8d3]",
    glyph: "📊",
  },
  İlan: {
    badge: "border-[#ff7a45]/50 bg-[#ff7a45]/12 text-[#ffb694]",
    dot: "bg-[#ff7a45]",
    glyph: "🏷️",
  },
};

/** Kategori rozeti için ortak sınıflar. */
export const campusCategoryBadgeBase =
  "inline-flex shrink-0 items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]";
