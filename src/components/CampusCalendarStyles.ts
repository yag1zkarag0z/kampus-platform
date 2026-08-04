import type {
  AcademicAudience,
  AcademicCategory,
} from "@/data/academicCalendar";

/**
 * Hedef kitle etiketleri.
 *
 * Bir tarihin kimi bağladığı bu uygulamadaki en kritik bilgi: yanlış gruba
 * ait bir sınav tarihini kendine ait sanan öğrenci sınavı kaçırır. Bu yüzden
 * her grup kendi rengini taşır ve etiketler hiçbir görünümde gizlenmez.
 */
export const calendarAudienceStyles: Record<
  AcademicAudience,
  { badge: string; short: string }
> = {
  hazirlik: {
    badge: "border-[#7fb7d9]/45 bg-[#7fb7d9]/14 text-[#bcdcf0]",
    short: "Hazırlık",
  },
  onlisans_lisans: {
    badge: "border-[#ff7a45]/45 bg-[#ff7a45]/14 text-[#ffc0a4]",
    short: "Önlisans/Lisans",
  },
  lisansustu: {
    badge: "border-[#b79ae0]/45 bg-[#b79ae0]/14 text-[#dbcdf3]",
    short: "Lisansüstü",
  },
};

/**
 * Kategori kimliği: takvimde bir sınav ile bir tatili tek renkle ayırmak
 * mümkün olmadığı için her kategori kendi rengini taşır.
 */
export const calendarCategoryStyles: Record<
  AcademicCategory,
  { badge: string; dot: string; label: string }
> = {
  ders: {
    badge: "border-[#7fb7d9]/28 bg-[#7fb7d9]/12 text-[#a8d2ec]",
    dot: "bg-[#7fb7d9]",
    label: "Ders",
  },
  kayit: {
    badge: "border-[#9aa8d3]/28 bg-[#9aa8d3]/12 text-[#c4cce8]",
    dot: "bg-[#9aa8d3]",
    label: "Kayıt",
  },
  odeme: {
    badge: "border-[#c7a96d]/28 bg-[#c7a96d]/12 text-[#e3cf9c]",
    dot: "bg-[#c7a96d]",
    label: "Ödeme",
  },
  sinav: {
    badge: "border-[#ff7a45]/32 bg-[#ff7a45]/12 text-[#ffb694]",
    dot: "bg-[#ff7a45]",
    label: "Sınav",
  },
  tez: {
    badge: "border-[#b79ae0]/28 bg-[#b79ae0]/12 text-[#d3c1f0]",
    dot: "bg-[#b79ae0]",
    label: "Tez",
  },
  toren: {
    badge: "border-[#e0a083]/28 bg-[#e0a083]/12 text-[#f0c5b1]",
    dot: "bg-[#e0a083]",
    label: "Tören",
  },
  tatil: {
    badge: "border-[#8fba9b]/28 bg-[#8fba9b]/12 text-[#b5d8bd]",
    dot: "bg-[#8fba9b]",
    label: "Tatil",
  },
};

export const calendarFocusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";
