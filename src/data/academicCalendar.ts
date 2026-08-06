/**
 * Yaşar Üniversitesi 2026-2027 akademik takvimi.
 *
 * Tarihler resmî takvimden birebir aktarılmıştır. Bu veri yalnızca
 * bilgilendirme amaçlıdır; resmî kaynak üniversitenin yayımladığı takvimdir.
 */

export type AcademicAudience =
  | "hazirlik"
  | "onlisans_lisans"
  | "lisansustu";

export type AcademicTerm = "guz" | "bahar" | "yaz" | "genel";

export type AcademicCategory =
  | "ders"
  | "kayit"
  | "odeme"
  | "sinav"
  | "tez"
  | "toren"
  | "tatil";

export type AcademicEvent = {
  id: string;
  title: string;
  term: AcademicTerm;
  category: AcademicCategory;
  audiences: AcademicAudience[];
  /** ISO tarih (YYYY-MM-DD). */
  start: string;
  /** Çok günlü etkinliklerde son gün, dahil. */
  end?: string;
  note?: string;
};

export const ACADEMIC_YEAR_LABEL = "2026-2027";

/**
 * Bu verinin resmî takvimden en son ne zaman aktarıldığı.
 * Takvim her güncellendiğinde bu tarih de elle güncellenmelidir.
 */
export const ACADEMIC_CALENDAR_UPDATED_AT = "2026-08-04";

export const academicAudienceLabels: Record<AcademicAudience, string> = {
  hazirlik: "Hazırlık",
  onlisans_lisans: "Önlisans/Lisans",
  lisansustu: "Lisansüstü",
};

export const academicTermLabels: Record<AcademicTerm, string> = {
  guz: "Güz dönemi",
  bahar: "Bahar dönemi",
  yaz: "Yaz okulu",
  genel: "Genel",
};

export const academicCategoryLabels: Record<AcademicCategory, string> = {
  ders: "Ders",
  kayit: "Kayıt",
  odeme: "Ödeme",
  sinav: "Sınav",
  tez: "Tez",
  toren: "Tören",
  tatil: "Tatil",
};

const ALL_AUDIENCES: AcademicAudience[] = [
  "hazirlik",
  "onlisans_lisans",
  "lisansustu",
];

const DEGREE_AUDIENCES: AcademicAudience[] = [
  "onlisans_lisans",
  "lisansustu",
];

export const academicCalendar: AcademicEvent[] = [
  // --- Güz dönemi ---
  {
    id: "guz-flat-yazili-lu",
    title: "İngilizce Yeterlik Sınavı (Flat-Yazılı Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["lisansustu"],
    start: "2026-09-01",
  },
  {
    id: "guz-flat-sozlu-lu",
    title: "İngilizce Yeterlik Sınavı (Flat-Sözlü Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["lisansustu"],
    start: "2026-09-01",
  },
  {
    id: "guz-flat-yazili-hazirlik",
    title: "İngilizce Yeterlik Sınavı (Flat-Yazılı Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2026-09-08",
  },
  {
    id: "guz-flat-sozlu-hazirlik",
    title: "İngilizce Yeterlik Sınavı (Flat-Sözlü Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2026-09-09",
  },
  {
    id: "guz-duzey-belirleme",
    title: "İngilizce Hazırlık Sınıfı Öğrencileri İçin Düzey Belirleme Sınavı",
    term: "guz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2026-09-17",
  },
  {
    id: "guz-odeme-hazirlik",
    title: "Eğitim Ücreti Ödemesi",
    term: "guz",
    category: "odeme",
    audiences: ["hazirlik"],
    start: "2026-09-07",
    end: "2026-09-17",
  },
  {
    id: "guz-odeme",
    title: "Eğitim Ücreti Ödemesi",
    term: "guz",
    category: "odeme",
    audiences: DEGREE_AUDIENCES,
    start: "2026-09-07",
    end: "2026-09-18",
  },
  {
    id: "guz-ders-kayit",
    title: "Ders Kayıtları",
    term: "guz",
    category: "kayit",
    audiences: DEGREE_AUDIENCES,
    start: "2026-09-14",
    end: "2026-09-18",
  },
  {
    id: "guz-derslerin-baslamasi",
    title: "Derslerin Başlaması",
    term: "guz",
    category: "ders",
    audiences: ALL_AUDIENCES,
    start: "2026-09-21",
  },
  {
    id: "guz-ders-ekleme-cikarma",
    title: "Ders Ekleme-Çıkarma",
    term: "guz",
    category: "kayit",
    audiences: DEGREE_AUDIENCES,
    start: "2026-09-21",
    end: "2026-09-30",
  },
  {
    id: "guz-dersten-cekilme",
    title: "Dersten Çekilme Son Tarih",
    term: "guz",
    category: "kayit",
    audiences: ["onlisans_lisans"],
    start: "2026-10-09",
    note: "Lisansüstü programlarda uygulanmaz.",
  },
  {
    id: "guz-derslerin-sona-ermesi",
    title: "Derslerin Sona Ermesi",
    term: "guz",
    category: "ders",
    audiences: DEGREE_AUDIENCES,
    start: "2026-12-25",
    note: "07 Kasım 2026 Cumartesi 28 Ekim 2026 Çarşamba, 14 Kasım 2026 Cumartesi 29 Ekim 2026 Perşembe ders programıyla telafi edilir.",
  },
  {
    id: "guz-derslerin-sona-ermesi-hazirlik",
    title: "Derslerin Sona Ermesi",
    term: "guz",
    category: "ders",
    audiences: ["hazirlik"],
    start: "2027-01-08",
  },
  {
    id: "guz-tik-teslim",
    title:
      "Tez İzleme Komitesi Toplantı Sonuçlarının Teslimi İçin Son Gün (Temmuz-Aralık Dönemi)",
    term: "guz",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2026-12-28",
  },
  {
    id: "guz-tez-savunma-talep",
    title: "Tez Savunması Talep Formlarının Enstitüye İletimi İçin Son Gün",
    term: "guz",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2026-12-31",
  },
  {
    id: "guz-donem-sonu-sinav-1",
    title: "Dönem Sonu Sınavları",
    term: "guz",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2026-12-26",
    end: "2026-12-30",
  },
  {
    id: "guz-donem-sonu-sinav-2",
    title: "Dönem Sonu Sınavları",
    term: "guz",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-04",
    end: "2027-01-12",
  },
  {
    id: "guz-flat-yazili-ocak",
    title: "İngilizce Yeterlik Sınavı (Flat-Yazılı Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2027-01-12",
  },
  {
    id: "guz-flat-sozlu-ocak",
    title: "İngilizce Yeterlik Sınavı (Flat-Sözlü Oturum)",
    term: "guz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2027-01-13",
  },
  {
    id: "guz-not-giris",
    title: "Dönem Sonu Sınavları Not Girişleri Son Tarihi",
    term: "guz",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-13",
  },
  {
    id: "guz-doktora-yeterlik-teslim",
    title:
      "Doktora Yeterlik ve Tez Savunması Sonuçlarının Enstitüye Teslimi İçin Son Tarih (Güz Dönemi Mezuniyeti)",
    term: "guz",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-01-13",
  },
  {
    id: "guz-maddi-hata-basvuru",
    title: "Maddi Hata Başvuru",
    term: "guz",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-14",
    end: "2027-01-19",
  },
  {
    id: "guz-maddi-hata-sonuc",
    title: "Maddi Hata Başvurularının Sonuçlanması",
    term: "guz",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-20",
  },
  {
    id: "guz-iki-ders-basvuru",
    title: "İki Ders Sınavı Başvuruları Son Tarih",
    term: "guz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-01-20",
  },
  {
    id: "guz-iki-ders-sinav",
    title: "İki Ders Sınavı",
    term: "guz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-01-25",
    end: "2027-01-26",
  },
  {
    id: "guz-iki-ders-not",
    title: "İki Ders Sınavı Not Girişleri Son Tarih",
    term: "guz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-01-27",
  },

  // --- Bahar dönemi ---
  {
    id: "bahar-odeme-hazirlik",
    title: "Eğitim Ücreti Ödemesi",
    term: "bahar",
    category: "odeme",
    audiences: ["hazirlik"],
    start: "2027-01-18",
    end: "2027-01-28",
    note: "Kayıtlı öğrenciler için İngilizce hazırlık sınıfı dahildir.",
  },
  {
    id: "bahar-odeme",
    title: "Eğitim Ücreti Ödemesi",
    term: "bahar",
    category: "odeme",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-18",
    end: "2027-01-29",
  },
  {
    id: "bahar-ders-kayit",
    title: "Ders Kayıtları",
    term: "bahar",
    category: "kayit",
    audiences: DEGREE_AUDIENCES,
    start: "2027-01-26",
    end: "2027-01-29",
  },
  {
    id: "bahar-derslerin-baslamasi",
    title: "Derslerin Başlaması",
    term: "bahar",
    category: "ders",
    audiences: ALL_AUDIENCES,
    start: "2027-02-01",
  },
  {
    id: "bahar-ders-ekleme-cikarma",
    title: "Ders Ekleme-Çıkarma",
    term: "bahar",
    category: "kayit",
    audiences: DEGREE_AUDIENCES,
    start: "2027-02-01",
    end: "2027-02-10",
  },
  {
    id: "bahar-dersten-cekilme",
    title: "Dersten Çekilme Son Tarih",
    term: "bahar",
    category: "kayit",
    audiences: ["onlisans_lisans"],
    start: "2027-02-19",
    note: "Lisansüstü programlarda uygulanmaz.",
  },
  {
    id: "bahar-derslerin-sona-ermesi",
    title: "Derslerin Sona Ermesi",
    term: "bahar",
    category: "ders",
    audiences: DEGREE_AUDIENCES,
    start: "2027-05-14",
    note: "08 Mayıs 2027 Cumartesi 23 Nisan 2027 Cuma ders programıyla telafi edilir.",
  },
  {
    id: "bahar-derslerin-sona-ermesi-hazirlik",
    title: "Derslerin Sona Ermesi",
    term: "bahar",
    category: "ders",
    audiences: ["hazirlik"],
    start: "2027-06-04",
  },
  {
    id: "bahar-donem-sonu-sinav",
    title: "Dönem Sonu Sınavları",
    term: "bahar",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-05-24",
    end: "2027-06-06",
  },
  {
    id: "bahar-not-giris",
    title: "Dönem Sonu Sınavları Not Girişleri Son Tarih",
    term: "bahar",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-06-07",
  },
  {
    id: "bahar-tez-savunma-talep",
    title:
      "Tez Savunması Talep Formlarının Enstitüye İletimi İçin Son Gün (Mezuniyet Törenine Katılacaklar)",
    term: "bahar",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-05-24",
  },
  {
    id: "bahar-tez-savunma-sonuc",
    title:
      "Tez Savunması Sonuçlarının Enstitüye Teslimi İçin Son Tarih (Mezuniyet Törenine Katılacaklar)",
    term: "bahar",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-06-07",
  },
  {
    id: "bahar-tik-teslim",
    title:
      "Tez İzleme Komitesi Toplantı Sonuçlarının Enstitüye Teslimi İçin Son Tarih (Ocak-Haziran Dönemi)",
    term: "bahar",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-06-30",
  },
  {
    id: "bahar-maddi-hata-basvuru",
    title: "Maddi Hata Başvuru",
    term: "bahar",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-06-08",
    end: "2027-06-11",
  },
  {
    id: "bahar-maddi-hata-sonuc",
    title: "Maddi Hata Başvurularının Sonuçlanması",
    term: "bahar",
    category: "sinav",
    audiences: DEGREE_AUDIENCES,
    start: "2027-06-14",
  },
  {
    id: "bahar-iki-ders-basvuru",
    title: "İki Ders Sınavı Başvuruları Son Tarih",
    term: "bahar",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-06-14",
  },
  {
    id: "bahar-iki-ders-sinav",
    title: "İki Ders Sınavı",
    term: "bahar",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-06-17",
    end: "2027-06-18",
  },
  {
    id: "bahar-iki-ders-not",
    title: "İki Ders Sınavı Not Girişleri Son Tarih",
    term: "bahar",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-06-20",
  },
  {
    id: "bahar-flat-yazili",
    title: "İngilizce Yeterlik Sınavı (Flat-Yazılı Oturum)",
    term: "bahar",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2027-06-09",
  },
  {
    id: "bahar-flat-sozlu",
    title: "İngilizce Yeterlik Sınavı (Flat-Sözlü Oturum)",
    term: "bahar",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2027-06-09",
  },

  // --- Yaz okulu ---
  {
    id: "yaz-ders-kayit-hazirlik",
    title: "Ders Kayıtları",
    term: "yaz",
    category: "kayit",
    audiences: ["hazirlik"],
    start: "2027-06-16",
    end: "2027-06-18",
  },
  {
    id: "yaz-ders-kayit",
    title: "Ders Kayıtları",
    term: "yaz",
    category: "kayit",
    audiences: ["onlisans_lisans"],
    start: "2027-06-14",
    end: "2027-06-15",
  },
  {
    id: "yaz-derslerin-baslamasi",
    title: "Derslerin Başlaması",
    term: "yaz",
    category: "ders",
    audiences: ["hazirlik", "onlisans_lisans"],
    start: "2027-06-21",
  },
  {
    id: "yaz-tez-savunma-talep",
    title:
      "Tez Savunması Talep Formlarının Enstitüye İletimi İçin Son Tarih (2026-2027 Mezuniyeti)",
    term: "yaz",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-07-23",
  },
  {
    id: "yaz-derslerin-sona-ermesi",
    title: "Derslerin Sona Ermesi",
    term: "yaz",
    category: "ders",
    audiences: ["onlisans_lisans"],
    start: "2027-08-06",
    note: "17 Temmuz 2027 Cumartesi 15 Temmuz 2027 Perşembe ders programıyla telafi edilir.",
  },
  {
    id: "yaz-derslerin-sona-ermesi-hazirlik",
    title: "Derslerin Sona Ermesi",
    term: "yaz",
    category: "ders",
    audiences: ["hazirlik"],
    start: "2027-08-09",
  },
  {
    id: "yaz-not-giris",
    title: "Yaz Okulu Not Girişleri Son Tarih",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-08",
  },
  {
    id: "yaz-doktora-yeterlik-teslim",
    title:
      "Doktora Yeterlik ve Tez Savunması Sonuçlarının Enstitüye Teslimi İçin Son Tarih (2026-2027 Mezuniyeti)",
    term: "yaz",
    category: "tez",
    audiences: ["lisansustu"],
    start: "2027-08-08",
  },
  {
    id: "yaz-maddi-hata-basvuru",
    title: "Maddi Hata Başvuru",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-09",
    end: "2027-08-12",
  },
  {
    id: "yaz-maddi-hata-sonuc",
    title: "Maddi Hata Başvurularının Sonuçlanması",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-13",
  },
  {
    id: "yaz-iki-ders-basvuru",
    title: "İki Ders Sınavı Başvuruları Son Tarih",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-13",
  },
  {
    id: "yaz-iki-ders-sinav",
    title: "İki Ders Sınavı",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-16",
    end: "2027-08-17",
  },
  {
    id: "yaz-iki-ders-not",
    title: "İki Ders Sınavı Not Girişleri Son Tarih",
    term: "yaz",
    category: "sinav",
    audiences: ["onlisans_lisans"],
    start: "2027-08-18",
  },
  {
    id: "yaz-flat",
    title: "İngilizce Yeterlik Sınavı (Flat)",
    term: "yaz",
    category: "sinav",
    audiences: ["hazirlik"],
    start: "2027-08-10",
  },

  // --- Genel ---
  {
    id: "mezuniyet-toreni",
    title: "Mezuniyet Töreni",
    term: "genel",
    category: "toren",
    audiences: ALL_AUDIENCES,
    start: "2027-06-30",
    end: "2027-07-01",
  },

  // --- Resmî tatiller ---
  {
    id: "tatil-cumhuriyet",
    title: "Cumhuriyet Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2026-10-29",
    note: "28 Ekim 2026 Çarşamba dersler yapılmaz.",
  },
  {
    id: "tatil-yilbasi",
    title: "Yılbaşı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-01-01",
  },
  {
    id: "tatil-ramazan",
    title: "Ramazan Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-03-08",
    end: "2027-03-11",
    note: "08 Mart 2027 Pazartesi arife günüdür.",
  },
  {
    id: "tatil-ulusal-egemenlik",
    title: "Ulusal Egemenlik ve Çocuk Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-04-23",
  },
  {
    id: "tatil-emek",
    title: "Emek ve Dayanışma Günü",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-05-01",
  },
  {
    id: "tatil-kurban",
    title: "Kurban Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-05-15",
    end: "2027-05-19",
    note: "15 Mayıs 2027 Cumartesi arife günüdür.",
  },
  {
    id: "tatil-ataturku-anma",
    title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-05-19",
  },
  {
    id: "tatil-demokrasi",
    title: "Demokrasi ve Milli Birlik Günü",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-07-15",
  },
  {
    id: "tatil-zafer",
    title: "Zafer Bayramı",
    term: "genel",
    category: "tatil",
    audiences: ALL_AUDIENCES,
    start: "2027-08-30",
  },
];

const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

const dayWithYearFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
});

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
});

/** Yerel saat diliminde gün başlangıcı; saat farkı gün kaymasına yol açmasın. */
export function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year!, month! - 1, day!);
}

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function getEventEndDate(event: AcademicEvent) {
  return parseCalendarDate(event.end ?? event.start);
}

export function formatEventDate(event: AcademicEvent) {
  const start = parseCalendarDate(event.start);

  if (!event.end) {
    return dayWithYearFormatter.format(start);
  }

  const end = parseCalendarDate(event.end);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  return sameMonth
    ? `${start.getDate()}-${dayWithYearFormatter.format(end)}`
    : `${dayFormatter.format(start)} - ${dayWithYearFormatter.format(end)}`;
}

export function formatCalendarUpdatedAt() {
  return dayWithYearFormatter.format(
    parseCalendarDate(ACADEMIC_CALENDAR_UPDATED_AT),
  );
}

export function formatEventWeekday(event: AcademicEvent) {
  return event.end ? null : weekdayFormatter.format(parseCalendarDate(event.start));
}

export function formatEventBadge(event: AcademicEvent) {
  const start = parseCalendarDate(event.start);

  return {
    day: String(start.getDate()),
    month: shortMonthFormatter
      .format(start)
      .replace(".", "")
      .toLocaleUpperCase("tr-TR"),
  };
}

export type EventTiming =
  | { state: "ongoing" }
  | { state: "today" }
  | { state: "upcoming"; days: number }
  | { state: "past" };

export function getEventTiming(
  event: AcademicEvent,
  now = new Date(),
): EventTiming {
  const today = startOfDay(now);
  const start = parseCalendarDate(event.start);
  const end = getEventEndDate(event);

  if (today > end) {
    return { state: "past" };
  }

  if (today >= start) {
    return today.getTime() === start.getTime() && !event.end
      ? { state: "today" }
      : { state: "ongoing" };
  }

  const days = Math.round(
    (start.getTime() - today.getTime()) / 86_400_000,
  );

  return { state: "upcoming", days };
}

export function formatEventTiming(timing: EventTiming) {
  switch (timing.state) {
    case "ongoing":
      return "Devam ediyor";
    case "today":
      return "Bugün";
    case "upcoming":
      return timing.days === 1 ? "Yarın" : `${timing.days} gün kaldı`;
    case "past":
      return "Tamamlandı";
  }
}

function compareEvents(first: AcademicEvent, second: AcademicEvent) {
  return (
    parseCalendarDate(first.start).getTime() -
      parseCalendarDate(second.start).getTime() ||
    first.title.localeCompare(second.title, "tr")
  );
}

export function filterByAudience(
  events: AcademicEvent[],
  audience: AcademicAudience | "all",
) {
  return audience === "all"
    ? events
    : events.filter((event) => event.audiences.includes(audience));
}

/** Bugün dahil, henüz bitmemiş etkinlikler. */
export function getUpcomingEvents(
  audience: AcademicAudience | "all" = "all",
  limit?: number,
  now = new Date(),
) {
  const today = startOfDay(now);
  const upcoming = filterByAudience(academicCalendar, audience)
    .filter((event) => getEventEndDate(event) >= today)
    .sort(compareEvents);

  return limit ? upcoming.slice(0, limit) : upcoming;
}

export function getEventsByTerm(
  audience: AcademicAudience | "all" = "all",
) {
  const terms: AcademicTerm[] = ["guz", "bahar", "yaz", "genel"];

  return terms.map((term) => ({
    term,
    events: filterByAudience(academicCalendar, audience)
      .filter((event) => event.term === term)
      .sort(compareEvents),
  }));
}

/** Verilen tarihte devam eden (başlamış ve bitmemiş) etkinlikler. */
export function getEventsOnDate(events: AcademicEvent[], date: Date) {
  const day = startOfDay(date);

  return events
    .filter((event) => {
      const start = parseCalendarDate(event.start);
      const end = getEventEndDate(event);
      return day >= start && day <= end;
    })
    .sort(compareEvents);
}
