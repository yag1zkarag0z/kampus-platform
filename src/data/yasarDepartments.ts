export const yasarDepartmentGroups = [
  {
    label: "Hukuk Fakültesi",
    departments: ["Hukuk"],
  },
  {
    label: "İletişim Fakültesi",
    departments: [
      "Görsel İletişim Tasarımı",
      "Halkla İlişkiler ve Reklamcılık",
      "Radyo, Televizyon ve Sinema",
      "Yeni Medya ve İletişim",
    ],
  },
  {
    label: "İnsan ve Toplum Bilimleri Fakültesi",
    departments: [
      "İngiliz Dili ve Edebiyatı",
      "İngilizce Mütercim ve Tercümanlık",
      "Psikoloji",
      "Uluslararası İlişkiler",
    ],
  },
  {
    label: "İşletme Fakültesi",
    departments: [
      "Ekonomi",
      "İşletme",
      "Lojistik Yönetimi",
      "Uluslararası Ticaret ve Finansman",
    ],
  },
  {
    label: "Mimarlık Fakültesi",
    departments: [
      "İç Mimarlık ve Çevre Tasarımı",
      "Mimarlık",
    ],
  },
  {
    label: "Mühendislik Fakültesi",
    departments: [
      "Bilgisayar Mühendisliği",
      "Elektrik-Elektronik Mühendisliği",
      "Endüstri Mühendisliği",
      "Enerji Sistemleri Mühendisliği",
      "İnşaat Mühendisliği",
      "Makine Mühendisliği",
      "Yazılım Mühendisliği",
    ],
  },
  {
    label: "Fen-Edebiyat Fakültesi",
    departments: ["Matematik"],
  },
  {
    label: "Sanat ve Tasarım Fakültesi",
    departments: [
      "Çizgi Film ve Animasyon",
      "Endüstriyel Tasarım",
      "Film Tasarımı",
      "Grafik Tasarımı (Lisans)",
      "Müzik",
    ],
  },
  {
    label: "Tarım Bilimleri ve Teknolojileri Fakültesi",
    departments: [
      "Tarım Ekonomisi",
      "Tarım Makineleri ve Teknolojileri Mühendisliği",
      "Toprak Bilimi ve Bitki Besleme",
    ],
  },
  {
    label: "Uygulamalı Bilimler Yüksekokulu",
    departments: [
      "Gastronomi ve Mutfak Sanatları",
      "Turizm Rehberliği",
      "Yönetim Bilişim Sistemleri",
    ],
  },
  {
    label: "Meslek Yüksekokulu",
    departments: [
      "Bankacılık ve Sigortacılık",
      "Bilgisayar Destekli Tasarım ve Animasyon",
      "Bilgisayar Programcılığı",
      "Deniz ve Liman İşletmeciliği",
      "Dış Ticaret",
      "Gıda Teknolojisi",
      "Grafik Tasarımı (Önlisans)",
      "Halkla İlişkiler ve Tanıtım",
      "İş Sağlığı ve Güvenliği",
      "Lojistik",
      "Marina ve Yat İşletmeciliği",
      "Mimari Restorasyon",
      "Turizm ve Otel İşletmeciliği",
    ],
  },
  {
    label: "Adalet Meslek Yüksekokulu",
    departments: ["Adalet"],
  },
  {
    label: "Diğer",
    departments: [
      "Lisansüstü program",
      "Listede olmayan program",
    ],
  },
] as const;

export const campusYearOptions = [
  "Hazırlık",
  "1. sınıf",
  "2. sınıf",
  "3. sınıf",
  "4. sınıf",
] as const;

const associateDegreePrograms = [
  "Adalet",
  "Bankacılık ve Sigortacılık",
  "Bilgisayar Destekli Tasarım ve Animasyon",
  "Bilgisayar Programcılığı",
  "Deniz ve Liman İşletmeciliği",
  "Dış Ticaret",
  "Gıda Teknolojisi",
  "Grafik Tasarımı (Önlisans)",
  "Halkla İlişkiler ve Tanıtım",
  "İş Sağlığı ve Güvenliği",
  "Lojistik",
  "Marina ve Yat İşletmeciliği",
  "Mimari Restorasyon",
  "Turizm ve Otel İşletmeciliği",
] as const;

const associateDegreeYearOptions = [
  "Hazırlık",
  "1. sınıf",
  "2. sınıf",
] as const;

const graduateYearOptions = ["Lisansüstü"] as const;

export function getCampusYearOptions(department: string): readonly string[] {
  if (department === "Lisansüstü program") {
    return graduateYearOptions;
  }

  if (
    (associateDegreePrograms as readonly string[]).includes(department)
  ) {
    return associateDegreeYearOptions;
  }

  return campusYearOptions;
}

const yasarDepartments = new Set(
  yasarDepartmentGroups.flatMap((group) => group.departments),
);

export function isListedYasarDepartment(department: string) {
  return yasarDepartments.has(
    department as (typeof yasarDepartmentGroups)[number]["departments"][number],
  );
}
