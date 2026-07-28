import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";

export type CampusFollowMember = {
  authorId: string;
  author: string;
  displayName: string;
  username: string;
  detail?: string;
  avatarDataUrl?: string;
};

export const campusFollowMembers: CampusFollowMember[] = [
  {
    authorId: LOCAL_ACCOUNT_OWNER_ID,
    author: "@yagizkaragoz",
    displayName: "Yağız Karagöz",
    username: "yagizkaragoz",
    detail: "Yazılım Mühendisliği",
  },
  {
    authorId: CAMPUS_OFFICIAL_AUTHOR_ID,
    author: "KAMPÜS",
    displayName: "KAMPÜS",
    username: "kampus",
    detail: "Resmî topluluk hesabı",
  },
  {
    authorId: "seed-ecearslan",
    author: "@ecearslan",
    displayName: "Ece Arslan",
    username: "ecearslan",
    detail: "İşletme",
  },
  {
    authorId: "seed-deniz",
    author: "@deniz",
    displayName: "Deniz Akın",
    username: "deniz",
    detail: "Endüstriyel Tasarım",
  },
  {
    authorId: "seed-mertcan",
    author: "@mertcan",
    displayName: "Mert Can",
    username: "mertcan",
    detail: "Ekonomi",
  },
  {
    authorId: "seed-selin",
    author: "@selin",
    displayName: "Selin Yılmaz",
    username: "selin",
    detail: "Psikoloji",
  },
  {
    authorId: "seed-canberk",
    author: "@canberk",
    displayName: "Can Berk",
    username: "canberk",
    detail: "Mimarlık",
  },
  {
    authorId: "seed-beril",
    author: "@beril",
    displayName: "Beril Aydın",
    username: "beril",
    detail: "Görsel İletişim Tasarımı",
  },
  {
    authorId: "ece-yilmaz",
    author: "@eceyilmaz",
    displayName: "Ece Yılmaz",
    username: "eceyilmaz",
  },
  {
    authorId: "technology-club",
    author: "@teknolojitoplulugu",
    displayName: "Teknoloji Topluluğu",
    username: "teknolojitoplulugu",
  },
  {
    authorId: "deniz-ari",
    author: "@denizari",
    displayName: "Deniz Arı",
    username: "denizari",
  },
  {
    authorId: "bora-demir",
    author: "@borademir",
    displayName: "Bora Demir",
    username: "borademir",
  },
  {
    authorId: "selin-kaya",
    author: "@selinkaya",
    displayName: "Selin Kaya",
    username: "selinkaya",
  },
  {
    authorId: "irem-ozturk",
    author: "@iremozturk",
    displayName: "İrem Öztürk",
    username: "iremozturk",
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
