export type CampusAdminRole = "admin" | "moderator" | "member";

export type CampusAdminAccountStatus = "active" | "suspended";

export type CampusManagedUser = {
  authorId: string;
  author: string;
  displayName: string;
  department: string;
  joinedLabel: string;
  role: CampusAdminRole;
  status: CampusAdminAccountStatus;
  suspendedAt?: number;
};

export const campusAdminRoleLabels: Record<CampusAdminRole, string> = {
  admin: "Yönetici",
  moderator: "Moderatör",
  member: "Üye",
};

export const seedCampusManagedUsers: CampusManagedUser[] = [
  {
    authorId: "local-current-account",
    author: "@kayaozturk",
    displayName: "Kaya Öztürk",
    department: "Yazılım Mühendisliği",
    joinedLabel: "Temmuz 2026",
    role: "admin",
    status: "active",
  },
  {
    authorId: "seed-ecearslan",
    author: "@ecearslan",
    displayName: "Ece Arslan",
    department: "İşletme",
    joinedLabel: "Haziran 2026",
    role: "moderator",
    status: "active",
  },
  {
    authorId: "seed-deniz",
    author: "@deniz",
    displayName: "Deniz Akın",
    department: "Endüstriyel Tasarım",
    joinedLabel: "Haziran 2026",
    role: "member",
    status: "active",
  },
  {
    authorId: "seed-mertcan",
    author: "@mertcan",
    displayName: "Mert Can",
    department: "Ekonomi",
    joinedLabel: "Temmuz 2026",
    role: "member",
    status: "active",
  },
  {
    authorId: "seed-selin",
    author: "@selin",
    displayName: "Selin Yılmaz",
    department: "Psikoloji",
    joinedLabel: "Temmuz 2026",
    role: "member",
    status: "active",
  },
  {
    authorId: "seed-canberk",
    author: "@canberk",
    displayName: "Can Berk",
    department: "Mimarlık",
    joinedLabel: "Mayıs 2026",
    role: "member",
    status: "active",
  },
  {
    authorId: "seed-beril",
    author: "@beril",
    displayName: "Beril Aydın",
    department: "Görsel İletişim Tasarımı",
    joinedLabel: "Temmuz 2026",
    role: "member",
    status: "active",
  },
];

