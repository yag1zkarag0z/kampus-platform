import type {
  AcademicAudience,
  AcademicCategory,
} from "@/data/academicCalendar";

/**
 * Takvim, uygulamanın koyu lacivert/turuncu paletini kullanır; ayrı bir
 * görsel dil kurmaz. Bilgi yoğun bir çizelge olduğu için renk yalnızca
 * ayrıştırma amacıyla kullanılır: kategori ve hedef kitle.
 */

export const calendarSurface =
  "border border-white/10 bg-white/[0.02]";

export const calendarHeaderSurface = "bg-canvas/95 backdrop-blur-xl";

export const calendarTile =
  "border border-white/10 bg-white/[0.03]";

export const calendarAudienceStyles: Record<
  AcademicAudience,
  { badge: string; short: string }
> = {
  hazirlik: {
    badge: "border border-[#7fb7d9]/45 bg-[#7fb7d9]/12 text-[#bcdcf0]",
    short: "Hazırlık",
  },
  onlisans_lisans: {
    badge: "border border-brand/45 bg-brand/12 text-[#ffad92]",
    short: "Ön/Lisans",
  },
  lisansustu: {
    badge: "border border-[#b79ae0]/45 bg-[#b79ae0]/12 text-[#dbcdf3]",
    short: "Lisansüstü",
  },
};

export const calendarCategoryStyles: Record<
  AcademicCategory,
  { badge: string; dot: string; label: string }
> = {
  ders: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#60a5fa]",
    label: "Ders",
  },
  kayit: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#818cf8]",
    label: "Kayıt",
  },
  odeme: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#fbbf24]",
    label: "Ödeme",
  },
  sinav: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-brand",
    label: "Sınav",
  },
  tez: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#a78bfa]",
    label: "Tez",
  },
  toren: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#fb7185]",
    label: "Tören",
  },
  tatil: {
    badge: "border border-white/10 bg-white/[0.04] text-white/68",
    dot: "bg-[#34d399]",
    label: "Tatil",
  },
};

export const calendarFocusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
