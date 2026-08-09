import { guestAuthors } from "@/data/campusPosts";
import type { NotificationDto } from "@/notifications/client";

/**
 * Misafirin bildirimler ekranını boş görmemesi için sabit veri. Gerçek
 * `guestCampusPosts`/`campusFollowMembers` kimliklerine referans verir ki
 * bir bildirime tıklayınca gerçekten var olan bir gönderi/profil açılsın.
 *
 * `createdAt` gerçek ISO zaman dizisi (`campusPosts.ts`'teki tarih hatasını
 * tekrarlamamak için `Date.now()` tabanlı, sabit sıra numarası değil).
 */
const minutesAgoIso = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const hoursAgoIso = (n: number) =>
  new Date(Date.now() - n * 60 * 60_000).toISOString();
const daysAgoIso = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60_000).toISOString();

export const guestNotifications: NotificationDto[] = [
  {
    id: "guest-notif-1",
    kind: "like",
    actor: {
      id: "seed-deniz",
      username: "deniz",
      displayName: "Deniz Akın",
      avatarUrl: guestAuthors.deniz.avatarUrl,
    },
    likeCount: 3,
    otherActors: [
      {
        id: "seed-ecearslan",
        username: "ecearslan",
        displayName: "Ece Arslan",
        avatarUrl: guestAuthors.ecearslan.avatarUrl,
      },
    ],
    post: {
      id: "campus-welcome",
      title: "Yeni döneme birlikte merhaba diyelim",
      isDeleted: false,
    },
    comment: null,
    isRead: false,
    createdAt: minutesAgoIso(6),
  },
  {
    id: "guest-notif-2",
    kind: "comment",
    actor: {
      id: "ece-yilmaz",
      username: "eceyilmaz",
      displayName: "Ece Yılmaz",
      avatarUrl: guestAuthors.eceyilmaz.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: {
      id: "best-study-spot",
      title: "Kampüste en iyi çalışma köşesi neresi?",
      isDeleted: false,
    },
    comment: {
      id: "comment-best-study-spot-ece",
      excerpt: "Notları PDF olarak da paylaşabilir misin? Çok işime yarar.",
      isDeleted: false,
    },
    isRead: false,
    createdAt: minutesAgoIso(20),
  },
  {
    id: "guest-notif-3",
    kind: "follow",
    actor: {
      id: "irem-ozturk",
      username: "iremozturk",
      displayName: "İrem Öztürk",
      avatarUrl: guestAuthors.iremozturk.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: null,
    comment: null,
    isRead: false,
    createdAt: minutesAgoIso(45),
  },
  {
    id: "guest-notif-4",
    kind: "mention",
    actor: {
      id: "deniz-ari",
      username: "denizari",
      displayName: "Deniz Arı",
      avatarUrl: guestAuthors.denizari.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: {
      id: "study-buddy",
      title: "Bu hafta birlikte çalışmak isteyen var mı?",
      isDeleted: false,
    },
    comment: {
      id: "comment-study-buddy-deniz",
      excerpt: "@sen geçen hafta bu hocanın kaynaklarını bulmuştun, değil mi?",
      isDeleted: false,
    },
    isRead: false,
    createdAt: hoursAgoIso(3),
  },
  {
    id: "guest-notif-5",
    kind: "like",
    actor: {
      id: "seed-mertcan",
      username: "mertcan",
      displayName: "Mert Can",
      avatarUrl: guestAuthors.mertcan.avatarUrl,
    },
    likeCount: 4,
    otherActors: [],
    post: {
      id: "campus-rules",
      title: "Kütüphanede sınav öncesi sessizlik krizi",
      isDeleted: false,
    },
    comment: null,
    isRead: true,
    createdAt: hoursAgoIso(5),
  },
  {
    id: "guest-notif-6",
    kind: "like",
    actor: {
      id: "seed-ecearslan",
      username: "ecearslan",
      displayName: "Ece Arslan",
      avatarUrl: guestAuthors.ecearslan.avatarUrl,
    },
    likeCount: 1,
    otherActors: [],
    post: {
      id: "coding-workshop",
      title: "Bu hafta atölyede arayüz tasarımına giriyoruz, gelmek isteyen?",
      isDeleted: false,
    },
    comment: null,
    isRead: true,
    createdAt: hoursAgoIso(7),
  },
  {
    id: "guest-notif-7",
    kind: "comment",
    actor: {
      id: "bora-demir",
      username: "borademir",
      displayName: "Bora Demir",
      avatarUrl: guestAuthors.borademir.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: {
      id: "campus-cafe-spots",
      title: "Kahve alıp çalışmak için hangi masa?",
      isDeleted: false,
    },
    comment: {
      id: "comment-campus-cafe-bora",
      excerpt: "Üst kattaki masalarda priz de varmış, bugün denedim.",
      isDeleted: false,
    },
    isRead: true,
    createdAt: daysAgoIso(1),
  },
  {
    id: "guest-notif-8",
    kind: "follow",
    actor: {
      id: "seed-mertcan",
      username: "mertcan",
      displayName: "Mert Can",
      avatarUrl: guestAuthors.mertcan.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: null,
    comment: null,
    isRead: true,
    createdAt: daysAgoIso(2),
  },
  {
    id: "guest-notif-9",
    kind: "comment",
    actor: {
      id: "irem-ozturk",
      username: "iremozturk",
      displayName: "İrem Öztürk",
      avatarUrl: guestAuthors.iremozturk.avatarUrl,
    },
    likeCount: null,
    otherActors: [],
    post: {
      id: "campus-photo-walk",
      title: "Bu hafta sonu kampüsün gözden kaçan köşelerini çekelim mi",
      isDeleted: false,
    },
    comment: {
      id: "comment-campus-photo-walk-irem",
      excerpt: "@sen geçen seferki rotayı biliyorsun, bize de katılır mısın?",
      isDeleted: false,
    },
    isRead: true,
    createdAt: daysAgoIso(3),
  },
  {
    id: "guest-notif-10",
    kind: "like",
    actor: {
      id: "selin-kaya",
      username: "selinkaya",
      displayName: "Selin Kaya",
      avatarUrl: guestAuthors.selinkaya.avatarUrl,
    },
    likeCount: 2,
    otherActors: [
      {
        id: "seed-beril",
        username: "beril",
        displayName: "Beril Aydın",
        avatarUrl: guestAuthors.beril.avatarUrl,
      },
    ],
    post: {
      id: "lost-blue-bottle",
      title: "C blok 2. katta mavi bir matara buldum",
      isDeleted: false,
    },
    comment: null,
    isRead: true,
    createdAt: daysAgoIso(4),
  },
];
