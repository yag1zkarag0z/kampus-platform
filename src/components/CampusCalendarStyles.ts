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

export const calendarHeaderSurface = "bg-[#0a0d16]/95 backdrop-blur-xl";

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
    badge: "border border-[#ff7a45]/45 bg-[#ff7a45]/12 text-[#ffc0a4]",
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
    badge: "border border-[#7fb7d9]/35 bg-[#7fb7d9]/10 text-[#a8d2ec]",
    dot: "bg-[#7fb7d9]",
    label: "Ders",
  },
  kayit: {
    badge: "border border-[#9aa8d3]/35 bg-[#9aa8d3]/10 text-[#c4cce8]",
    dot: "bg-[#9aa8d3]",
    label: "Kayıt",
  },
  odeme: {
    badge: "border border-[#c7a96d]/35 bg-[#c7a96d]/10 text-[#e3cf9c]",
    dot: "bg-[#c7a96d]",
    label: "Ödeme",
  },
  sinav: {
    badge: "border border-[#ff7a45]/45 bg-[#ff7a45]/12 text-[#ffb694]",
    dot: "bg-[#ff7a45]",
    label: "Sınav",
  },
  tez: {
    badge: "border border-[#b79ae0]/35 bg-[#b79ae0]/10 text-[#d3c1f0]",
    dot: "bg-[#b79ae0]",
    label: "Tez",
  },
  toren: {
    badge: "border border-[#e0a083]/35 bg-[#e0a083]/10 text-[#f0c5b1]",
    dot: "bg-[#e0a083]",
    label: "Tören",
  },
  tatil: {
    badge: "border border-[#8fba9b]/35 bg-[#8fba9b]/10 text-[#b5d8bd]",
    dot: "bg-[#8fba9b]",
    label: "Tatil",
  },
};

export const calendarFocusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";
