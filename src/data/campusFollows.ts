import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";
import { campusAvatarUrl } from "@/avatar/catalog";

export type CampusFollowMember = {
  authorId: string;
  author: string;
  displayName: string;
  username: string;
  detail?: string;
  bio?: string;
  joinedLabel?: string;
  avatarDataUrl?: string;
};

export const campusFollowMembers: CampusFollowMember[] = [
  {
    authorId: LOCAL_ACCOUNT_OWNER_ID,
    author: "@kayaozturk",
    displayName: "Kaya Öztürk",
    username: "kayaozturk",
    detail: "Yazılım Mühendisliği",
    bio: "Yazılım, ürün geliştirme ve kampüs projeleriyle ilgileniyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("kayaozturk"),
  },
  {
    authorId: CAMPUS_OFFICIAL_AUTHOR_ID,
    author: "KAMPÜS",
    displayName: "KAMPÜS",
    username: "kampus",
    detail: "Resmî topluluk hesabı",
    bio: "Kampüsten duyurular, topluluk haberleri ve önemli güncellemeler.",
    joinedLabel: "Resmî topluluk hesabı",
  },
  {
    authorId: "seed-ecearslan",
    author: "@ecearslan",
    displayName: "Ece Arslan",
    username: "ecearslan",
    detail: "İşletme",
    bio: "Girişimcilik, öğrenci kulüpleri ve kampüs etkinlikleriyle ilgileniyor.",
    joinedLabel: "Haziran 2026",
    avatarDataUrl: campusAvatarUrl("ecearslan"),
  },
  {
    authorId: "seed-deniz",
    author: "@deniz",
    displayName: "Deniz Akın",
    username: "deniz",
    detail: "Endüstriyel Tasarım",
    bio: "Tasarım, üretim ve yaratıcı kampüs projelerini takip ediyor.",
    joinedLabel: "Haziran 2026",
    avatarDataUrl: campusAvatarUrl("deniz-akin"),
  },
  {
    authorId: "seed-mertcan",
    author: "@mertcan",
    displayName: "Mert Can",
    username: "mertcan",
    detail: "Ekonomi",
    bio: "Ekonomi, finans ve öğrenci toplulukları üzerine paylaşımlar yapıyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("mertcan"),
  },
  {
    authorId: "seed-selin",
    author: "@selin",
    displayName: "Selin Yılmaz",
    username: "selin",
    detail: "Psikoloji",
    bio: "Psikoloji, kitaplar ve kampüs yaşamı hakkında konuşmayı seviyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("selin-yilmaz"),
  },
  {
    authorId: "seed-canberk",
    author: "@canberk",
    displayName: "Can Berk",
    username: "canberk",
    detail: "Mimarlık",
    bio: "Mimarlık, kent kültürü ve fotoğrafçılıkla ilgileniyor.",
    joinedLabel: "Mayıs 2026",
    avatarDataUrl: campusAvatarUrl("canberk"),
  },
  {
    authorId: "seed-beril",
    author: "@beril",
    displayName: "Beril Aydın",
    username: "beril",
    detail: "Görsel İletişim Tasarımı",
    bio: "İllüstrasyon, görsel tasarım ve yaratıcı etkinlikleri takip ediyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("beril-aydin"),
  },
  {
    authorId: "ece-yilmaz",
    author: "@eceyilmaz",
    displayName: "Ece Yılmaz",
    username: "eceyilmaz",
    detail: "İletişim Tasarımı",
    bio: "Tasarım, fotoğraf ve kampüs etkinlikleriyle ilgileniyor.",
    joinedLabel: "Haziran 2026",
    avatarDataUrl: campusAvatarUrl("ece-yilmaz"),
  },
  {
    authorId: "technology-club",
    author: "@teknolojitoplulugu",
    displayName: "Teknoloji Topluluğu",
    username: "teknolojitoplulugu",
    detail: "Öğrenci topluluğu",
    bio: "Yazılım, yapay zekâ ve teknoloji etkinliklerini kampüsle buluşturuyor.",
    joinedLabel: "Topluluk hesabı",
    avatarDataUrl: campusAvatarUrl("teknoloji-toplulugu"),
  },
  {
    authorId: "deniz-ari",
    author: "@denizari",
    displayName: "Deniz Arı",
    username: "denizari",
    detail: "Bilgisayar Mühendisliği",
    bio: "Açık kaynak, mobil uygulamalar ve teknoloji buluşmalarıyla ilgileniyor.",
    joinedLabel: "Mayıs 2026",
    avatarDataUrl: campusAvatarUrl("deniz-ari"),
  },
  {
    authorId: "bora-demir",
    author: "@borademir",
    displayName: "Bora Demir",
    username: "borademir",
    detail: "Endüstri Mühendisliği",
    bio: "Kariyer etkinlikleri, spor ve kampüs yaşamını takip ediyor.",
    joinedLabel: "Haziran 2026",
    avatarDataUrl: campusAvatarUrl("bora-demir"),
  },
  {
    authorId: "selin-kaya",
    author: "@selinkaya",
    displayName: "Selin Kaya",
    username: "selinkaya",
    detail: "Hukuk",
    bio: "Hukuk, öğrenci hakları ve sosyal sorumluluk projeleriyle ilgileniyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("selin-kaya"),
  },
  {
    authorId: "irem-ozturk",
    author: "@iremozturk",
    displayName: "İrem Öztürk",
    username: "iremozturk",
    detail: "Yeni Medya ve İletişim",
    bio: "Yeni medya, içerik üretimi ve kampüs etkinliklerini paylaşıyor.",
    joinedLabel: "Temmuz 2026",
    avatarDataUrl: campusAvatarUrl("irem-ozturk"),
  },
];

export const seedCampusFollowEdges: Record<string, string[]> = {
  [LOCAL_ACCOUNT_OWNER_ID]: [
    CAMPUS_OFFICIAL_AUTHOR_ID,
    "seed-ecearslan",
    "seed-deniz",
  ],
  [CAMPUS_OFFICIAL_AUTHOR_ID]: [],
  "seed-ecearslan": [
    LOCAL_ACCOUNT_OWNER_ID,
    CAMPUS_OFFICIAL_AUTHOR_ID,
    "seed-deniz",
  ],
  "seed-deniz": ["seed-ecearslan", "seed-selin"],
  "seed-mertcan": [
    LOCAL_ACCOUNT_OWNER_ID,
    CAMPUS_OFFICIAL_AUTHOR_ID,
  ],
  "seed-selin": [LOCAL_ACCOUNT_OWNER_ID, "seed-ecearslan"],
  "seed-canberk": [LOCAL_ACCOUNT_OWNER_ID, "seed-beril"],
  "seed-beril": ["seed-canberk", "seed-selin"],
  "ece-yilmaz": [LOCAL_ACCOUNT_OWNER_ID, CAMPUS_OFFICIAL_AUTHOR_ID],
  "technology-club": [CAMPUS_OFFICIAL_AUTHOR_ID],
  "deniz-ari": ["technology-club", "ece-yilmaz"],
  "bora-demir": ["deniz-ari"],
  "selin-kaya": ["ece-yilmaz", "bora-demir"],
  "irem-ozturk": ["technology-club", "selin-kaya"],
};
