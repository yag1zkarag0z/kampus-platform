export type CampusPostCategory =
  | "Sohbet"
  | "İtiraf"
  | "Soru"
  | "Etkinlik"
  | "Kayıp Eşya"
  | "Anket"
  | "İlan";

export const LOCAL_ACCOUNT_OWNER_ID = "local-current-account";
export const CAMPUS_OFFICIAL_AUTHOR_ID = "campus-official";

export type CampusComment = {
  createdAt?: number;
  likes?: number;
  liked?: boolean;
  replyCount?: number;
  id: string;
  author: string;
  authorId?: string;
  avatarUrl?: string;
  isAnonymous?: boolean;
  parentId?: string;
  edited?: boolean;
  isDeleted?: boolean;
  body: string;
  time: string;
  gif?: CampusGif;
};

export type CampusPostImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type CampusGif = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type CampusPollOption = {
  id: string;
  text: string;
  votes: number;
};

export type CampusPostPoll = {
  options: CampusPollOption[];
  selectedOptionId?: string;
};

export type CampusListingType = "Satılık" | "Aranıyor" | "Ücretsiz";

export type CampusListingCondition =
  | "Yeni"
  | "Az kullanılmış"
  | "Kullanılmış";

export type CampusPostListing = {
  type: CampusListingType;
  condition: CampusListingCondition;
  price: number;
};

export type CampusPost = {
  id: string;
  author: string;
  authorId?: string;
  avatarUrl?: string;
  isAnonymous?: boolean;
  detail?: string;
  category: CampusPostCategory;
  title: string;
  body: string;
  image?: CampusPostImage;
  gif?: CampusGif;
  poll?: CampusPostPoll;
  listing?: CampusPostListing;
  time: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  comments: CampusComment[];
  commentCount?: number;
  bookmarked: boolean;
  edited?: boolean;
  isDeleted?: boolean;
  /** Şikâyet eşiği sonrası otomatik gizlendi; yalnızca yazarına görünür. */
  isHidden?: boolean;
};

export type CampusAuthorReference = {
  author: string;
  authorId?: string;
  isAnonymous?: boolean;
};

export function getCampusPostCommentCount(
  post: Pick<CampusPost, "commentCount" | "comments">,
) {
  return post.commentCount ?? post.comments.length;
}

export function isAnonymousCampusAuthor(author: CampusAuthorReference) {
  return (
    author.isAnonymous === true ||
    author.author.trim().toLocaleLowerCase("tr-TR") === "anonim"
  );
}

export function isSameVisibleCampusAuthor(
  first: CampusAuthorReference,
  second: CampusAuthorReference,
) {
  if (
    isAnonymousCampusAuthor(first) ||
    isAnonymousCampusAuthor(second)
  ) {
    return false;
  }

  if (first.authorId && second.authorId) {
    return first.authorId === second.authorId;
  }

  return first.author === second.author;
}

/**
 * Sabit gönderilerin `time` etiketi ("8 dk", "Dün") elle yazılmış gerçekçi
 * metin; `createdAt` ise onunla eşleşen gerçek bir epoch değeri olmalı.
 * Önceden `createdAt` yalnızca azalan bir sıra numarasıydı (200, 199, ...) —
 * gerçek tarihe çevrilince (`new Date(200)`) gönderi detayında "1 Ocak 1970"
 * gibi anlamsız bir tarih çıkıyordu. Bu yardımcılar `time` etiketiyle
 * tutarlı, gerçek zamana dayalı bir `createdAt` üretir.
 */
const minutesAgo = (n: number) => Date.now() - n * 60_000;
const hoursAgo = (n: number) => Date.now() - n * 60 * 60_000;
const daysAgo = (n: number) => Date.now() - n * 24 * 60 * 60_000;

/** Herkese aynı çizgi-roman tarzı, gerçek kişi olmayan avatar üretir. */
function seedAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

/** Misafir akışındaki kurgusal öğrenciler — resmî KAMPÜS hesabı değil. */
const guestAuthors = {
  ecearslan: { author: "@ecearslan", authorId: "seed-ecearslan", avatarUrl: seedAvatar("ecearslan") },
  deniz: { author: "@deniz", authorId: "seed-deniz", avatarUrl: seedAvatar("deniz-akin") },
  mertcan: { author: "@mertcan", authorId: "seed-mertcan", avatarUrl: seedAvatar("mertcan") },
  selin: { author: "@selin", authorId: "seed-selin", avatarUrl: seedAvatar("selin-yilmaz") },
  canberk: { author: "@canberk", authorId: "seed-canberk", avatarUrl: seedAvatar("canberk") },
  beril: { author: "@beril", authorId: "seed-beril", avatarUrl: seedAvatar("beril-aydin") },
  eceyilmaz: { author: "@eceyilmaz", authorId: "ece-yilmaz", avatarUrl: seedAvatar("ece-yilmaz") },
  teknolojitoplulugu: {
    author: "@teknolojitoplulugu",
    authorId: "technology-club",
    avatarUrl: seedAvatar("teknoloji-toplulugu"),
  },
  denizari: { author: "@denizari", authorId: "deniz-ari", avatarUrl: seedAvatar("deniz-ari") },
  borademir: { author: "@borademir", authorId: "bora-demir", avatarUrl: seedAvatar("bora-demir") },
  selinkaya: { author: "@selinkaya", authorId: "selin-kaya", avatarUrl: seedAvatar("selin-kaya") },
  iremozturk: { author: "@iremozturk", authorId: "irem-ozturk", avatarUrl: seedAvatar("irem-ozturk") },
} as const;

type GuestAuthorKey = keyof typeof guestAuthors;

/** Bir yorumun `author`'una göre avatarı otomatik eşler. */
function withCommentAvatar(comment: CampusComment): CampusComment {
  const match = Object.values(guestAuthors).find(
    (candidate) => candidate.author === comment.author,
  );

  return match ? { ...comment, avatarUrl: match.avatarUrl } : comment;
}

type GuestCampusPostSeed = Omit<
  CampusPost,
  | "author"
  | "authorId"
  | "avatarUrl"
  | "isAnonymous"
  | "liked"
  | "comments"
  | "bookmarked"
> & {
  comments?: CampusComment[];
};

/**
 * Misafir akışındaki her gönderi gerçek bir öğrenci kimliğine (avatarıyla
 * birlikte) ait — resmî bir KAMPÜS hesabı yok, hepsi "biri paylaştı" hissi
 * versin diye.
 */
function createGuestCampusPost(
  authorKey: GuestAuthorKey,
  { comments = [], ...post }: GuestCampusPostSeed,
): CampusPost {
  const author = guestAuthors[authorKey];

  return {
    ...post,
    author: author.author,
    authorId: author.authorId,
    avatarUrl: author.avatarUrl,
    isAnonymous: false,
    liked: false,
    comments: comments.map(withCommentAvatar),
    bookmarked: false,
  };
}

export const guestCampusPosts: CampusPost[] = [
  createGuestCampusPost("ecearslan", {
    id: "campus-welcome",
    detail: "Yeni başlayan",
    category: "Sohbet",
    title: "Yeni döneme 'merhaba' demenin en iyi yolu neymiş",
    body: "Bugün ilk kez kampüse geldim, hâlâ hangi asansörün çalıştığını çözmeye uğraşıyorum. Yardımsever biri yol tarifi yapar mı?",
    image: {
      src: "/images/campus-feed/yasar-university-entrance.jpg",
      width: 1200,
      height: 750,
      alt: "Yaşar Üniversitesi giriş tabelası ve Türk bayrağı",
    },
    time: "Şimdi",
    createdAt: minutesAgo(0),
    likes: 84,
  }),
  createGuestCampusPost("mertcan", {
    id: "printer-emergency",
    detail: "Kampüs SOS",
    category: "Sohbet",
    title: "Kütüphane yazıcısı yine bozuldu",
    body: "Ödev teslimine 20 dakika kala yazıcı sıkışırsa ne yapılır diye bir el kitabı yazılmalı artık. Yakında çalışan bir yazıcı bilen var mı?",
    time: "5 dk",
    createdAt: minutesAgo(5),
    likes: 34,
    comments: [
      {
        id: "comment-printer-emergency-selin",
        author: "@selin",
        authorId: "seed-selin",
        body: "B blok girişindeki hâlâ çalışıyor, az önce oradan çıktım.",
        time: "2 dk",
        createdAt: minutesAgo(2),
      },
    ],
  }),
  createGuestCampusPost("selin", {
    id: "campus-today",
    detail: "Günün karesi",
    category: "Sohbet",
    title: "Ders arası kampüs yolu yine tıklım tıklım",
    body: "Bu ışıkta çekilen her fotoğraf oluyor resmen. Kampüste bugün en sevdiğiniz kare neresi oldu?",
    image: {
      src: "/images/campus-feed/campus-walkway.jpg",
      width: 1200,
      height: 750,
      alt: "Ağaçların arasındaki kampüs yolunda yürüyen öğrenciler",
    },
    time: "8 dk",
    createdAt: minutesAgo(8),
    likes: 46,
  }),
  createGuestCampusPost("canberk", {
    id: "best-study-spot",
    detail: "Kampüs rehberi",
    category: "Soru",
    title: "Kampüste en iyi çalışma köşesi neresi?",
    body: "Sessiz, priz bulunan ve uzun süre rahatça çalışılabilen yerleri yeni gelenler için bu gönderinin altında toplayalım.",
    image: {
      src: "/images/campus-feed/library-study.jpg",
      width: 1200,
      height: 750,
      alt: "Kütüphanede bilgisayarlarıyla çalışan öğrenciler",
    },
    time: "19 dk",
    createdAt: minutesAgo(19),
    likes: 61,
    comments: [
      {
        id: "comment-best-study-spot-ece",
        author: "@eceyilmaz",
        authorId: "ece-yilmaz",
        body: "Notları PDF olarak da paylaşabilir misin? Çok işime yarar.",
        time: "4 dk",
        createdAt: minutesAgo(4),
      },
    ],
  }),
  createGuestCampusPost("beril", {
    id: "found-headphones",
    detail: "Kayıp eşya",
    category: "Kayıp Eşya",
    title: "Amfi C'de kulaklık bulundu",
    body: "Ders sonrası sıralarda siyah kablosuz kulaklık buldum. Kutusu üzerinde 'D.A.' yazıyordu, danışmaya bıraktım.",
    time: "26 dk",
    createdAt: minutesAgo(26),
    likes: 22,
    comments: [
      {
        id: "comment-found-headphones-denizari",
        author: "@denizari",
        authorId: "deniz-ari",
        body: "Bu benimkiler olabilir, hemen danışmaya bakıyorum. Çok teşekkürler!",
        time: "14 dk",
        createdAt: minutesAgo(14),
      },
    ],
  }),
  createGuestCampusPost("iremozturk", {
    id: "break-place-poll",
    detail: "Topluluk anketi",
    category: "Anket",
    title: "Ders arasında ilk durağın neresi?",
    body: "Kısa molalarda kampüsün en çok hangi tarafında vakit geçiriyoruz?",
    poll: {
      options: [
        { id: "break-coffee", text: "Kahve", votes: 46 },
        { id: "break-courtyard", text: "Avlu", votes: 38 },
        { id: "break-library", text: "Kütüphane", votes: 57 },
        { id: "break-canteen", text: "Kantin", votes: 29 },
      ],
    },
    time: "31 dk",
    createdAt: minutesAgo(31),
    likes: 93,
  }),
  createGuestCampusPost("deniz", {
    id: "club-meetups",
    detail: "Kulüp günü",
    category: "Sohbet",
    title: "Kulüp standı gezmek plandan çok daha uzun sürdü",
    body: "Avluda kulüp tanışma gününe uğradım, üç standta oyalanıp iki kulübe birden yazıldım resmen. Siz bugün hangi standa takıldınız?",
    image: {
      src: "/images/campus-feed/campus-conversation.jpg",
      width: 1200,
      height: 750,
      alt: "Kampüs binasının önünde konuşan iki öğrenci",
    },
    time: "47 dk",
    createdAt: minutesAgo(47),
    likes: 72,
    comments: [
      {
        id: "comment-club-meetups-canberk",
        author: "@canberk",
        authorId: "seed-canberk",
        body: "Fotoğrafçılık kulübü de bu sene stant açtı, ona da uğrayın.",
        time: "30 dk",
        createdAt: minutesAgo(30),
      },
    ],
  }),
  createGuestCampusPost("selin", {
    id: "weekend-hiking-plan",
    detail: "Hafta sonu planı",
    category: "Etkinlik",
    title: "Cumartesi kısa bir yürüyüşe ne dersiniz?",
    body: "Hava da güzel gidiyor, kampüs yakınındaki patikada sakin bir yürüyüş yapıp kahve molası vermek isteyenler yazabilir.",
    image: {
      src: "/images/campus-feed/campus-autumn.jpg",
      width: 1200,
      height: 750,
      alt: "Sonbaharda kampüs yolunda yürüyen bir öğrenci",
    },
    time: "55 dk",
    createdAt: minutesAgo(55),
    likes: 47,
    comments: [
      {
        id: "comment-weekend-hiking-irem",
        author: "@iremozturk",
        authorId: "irem-ozturk",
        body: "Kesinlikle varım, saat kaçta buluşuyoruz?",
        time: "40 dk",
        createdAt: minutesAgo(40),
        gif: {
          id: "26ufdipQqU2lhNA4g",
          src: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
          width: 480,
          height: 270,
          alt: "Şaşkınlık ve mutluluk tepki GIF'i",
        },
      },
      {
        id: "comment-weekend-hiking-bora",
        author: "@borademir",
        authorId: "bora-demir",
        body: "10.00 gibi ana kapıda buluşalım, geç kalmayalım.",
        time: "30 dk",
        createdAt: minutesAgo(30),
      },
    ],
  }),
  createGuestCampusPost("beril", {
    id: "community-thanks",
    detail: "Küçük bir teşekkür",
    category: "İtiraf",
    title: "Kütüphanede notlarımı bulup bırakan kişiye teşekkürler",
    body: "Bugün masada unuttuğum ders notlarımı danışmaya teslim eden kim olduysa gerçekten hayatımı kurtardın. Final haftasında böyle küçük iyilikler resmen moral oluyor.",
    time: "1 sa",
    createdAt: hoursAgo(1),
    likes: 128,
    gif: {
      id: "26ufdipQqU2lhNA4g",
      src: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
      width: 480,
      height: 270,
      alt: "Şaşkınlık ve mutluluk tepki GIF'i",
    },
  }),
  createGuestCampusPost("teknolojitoplulugu", {
    id: "coding-workshop",
    detail: "Atölye",
    category: "Etkinlik",
    title: "Bu hafta atölyede arayüz tasarımına giriyoruz, gelmek isteyen?",
    body: "HTML ve CSS bilmen yeterli, bilgisayarını getirmen yeter. İlk kez gelecekler için de rahat bir başlangıç köşesi ayarlıyoruz, çekinmeden gelin.",
    image: {
      src: "/images/campus-feed/coding-workshop.jpg",
      width: 1200,
      height: 750,
      alt: "Bilgisayarlarıyla kodlama atölyesinde çalışan öğrenciler",
    },
    time: "1 sa",
    createdAt: hoursAgo(1),
    likes: 65,
    comments: [
      {
        id: "comment-coding-workshop-club",
        author: "@denizari",
        authorId: "deniz-ari",
        body: "Kontenjanda hâlâ yer var mı, ben de yazılmak istiyorum.",
        time: "3 sa",
        createdAt: hoursAgo(3),
      },
    ],
  }),
  createGuestCampusPost("canberk", {
    id: "design-book-listing",
    detail: "Öğrenci ilanı",
    category: "İlan",
    title: "Temel Tasarım kitabı yeni sahibini arıyor",
    body: "Kitabım temiz durumda, sadece birkaç sayfada kurşun kalemle notlarım var. İhtiyacı olan yazsın.",
    image: {
      src: "/images/campus-feed/library-group.jpg",
      width: 1200,
      height: 750,
      alt: "Kitapların önünde birlikte çalışan öğrenciler",
    },
    listing: {
      type: "Satılık",
      condition: "Az kullanılmış",
      price: 180,
    },
    time: "2 sa",
    createdAt: hoursAgo(2),
    likes: 24,
    comments: [
      {
        id: "comment-design-book-listing-beril",
        author: "@beril",
        authorId: "seed-beril",
        body: "Notların fotoğrafını atabilir misin, kapak durumu nasıl merak ettim.",
        time: "1 sa",
        createdAt: hoursAgo(1),
      },
    ],
  }),
  createGuestCampusPost("mertcan", {
    id: "open-study-session",
    detail: "Çalışma daveti",
    category: "Etkinlik",
    title: "Öğleden sonra birlikte çalışacak biri arıyorum",
    body: "Konu fark etmez, aynı masada sessizce çalışıp mola saatlerini birlikte ayarlarız. 14.00'te çalışma salonundayım, gelmek isteyen yazsın.",
    image: {
      src: "/images/campus-feed/classroom-study.jpg",
      width: 1200,
      height: 750,
      alt: "Aynı sınıfta ders çalışan bir grup öğrenci",
    },
    time: "2 sa",
    createdAt: hoursAgo(2),
    likes: 97,
    comments: [
      {
        id: "comment-open-study-session-selin",
        author: "@selin",
        authorId: "seed-selin",
        body: "Ben geliyorum, kulaklıksız çalışma sözü veriyorum bu sefer.",
        time: "1 sa",
        createdAt: hoursAgo(1),
      },
    ],
  }),
  createGuestCampusPost("ecearslan", {
    id: "study-buddy",
    detail: "Çalışma grubu",
    category: "Soru",
    title: "Bu hafta birlikte çalışmak isteyen var mı?",
    body: "Aynı derse çalışan öğrencilerin birbirini bulabilmesi için dersin adını ve uygun olduğun saati yazabilirsin.",
    time: "3 sa",
    createdAt: hoursAgo(3),
    likes: 42,
    comments: [
      {
        id: "comment-study-buddy-deniz",
        author: "@denizari",
        authorId: "deniz-ari",
        body: "@sen geçen hafta bu hocanın kaynaklarını bulmuştun, değil mi?",
        time: "18 dk",
        createdAt: minutesAgo(18),
        gif: {
          id: "l0MYt5jPR6QX5pnqM",
          src: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
          width: 480,
          height: 270,
          alt: "Eğlenceli tepki GIF'i",
        },
      },
    ],
  }),
  createGuestCampusPost("teknolojitoplulugu", {
    id: "technology-club",
    detail: "Proje masası",
    category: "Etkinlik",
    title: "Proje masasına ne üzerinde çalışıyorsan getir",
    body: "Devre, yazılım, tasarım fark etmez; uğraştığın fikri getir. Ekip arayanlarla proje arayanları bu hafta aynı masada buluşturuyoruz.",
    image: {
      src: "/images/campus-feed/technology-workshop.jpg",
      width: 1200,
      height: 750,
      alt: "Elektronik proje üzerinde çalışan öğrenciler",
    },
    time: "3 sa",
    createdAt: hoursAgo(3),
    likes: 88,
    comments: [
      {
        id: "comment-technology-club-eceyilmaz",
        author: "@eceyilmaz",
        authorId: "ece-yilmaz",
        body: "Tasarım tarafından katılmak istiyorum, arayüz için ekip lazım mı?",
        time: "2 sa",
        createdAt: hoursAgo(2),
      },
    ],
  }),
  createGuestCampusPost("iremozturk", {
    id: "campus-cafe-spots",
    detail: "Kampüs rehberi",
    category: "Soru",
    title: "Kahve alıp çalışmak için hangi masa?",
    body: "Kalabalığın içinde çalışmayı sevenler için kampüs çevresindeki rahat masaları ve sakin saatleri burada toplayalım.",
    image: {
      src: "/images/campus-feed/campus-cafe.jpg",
      width: 1200,
      height: 750,
      alt: "Kafede kitap ve bilgisayarlarıyla çalışan öğrenciler",
    },
    time: "4 sa",
    createdAt: hoursAgo(4),
    likes: 53,
    comments: [
      {
        id: "comment-campus-cafe-bora",
        author: "@borademir",
        authorId: "bora-demir",
        body: "Üst kattaki masalarda priz de varmış, bugün denedim.",
        time: "Dün",
        createdAt: daysAgo(1),
      },
    ],
  }),
  createGuestCampusPost("borademir", {
    id: "lost-blue-bottle",
    detail: "Kayıp eşya",
    category: "Kayıp Eşya",
    title: "C blok 2. katta mavi bir matara buldum",
    body: "Oturma alanındaki koltuklardan birinde duruyordu, üzerinde küçük bir etiket var. Güvenliğe teslim ettim, tarif edebilen sahibine ulaşsın.",
    time: "4 sa",
    createdAt: hoursAgo(4),
    likes: 31,
    comments: [
      {
        id: "comment-lost-blue-bottle-selin",
        author: "@selinkaya",
        authorId: "selin-kaya",
        body: "Bu benim olabilir, hemen güvenliğe gidiyorum. Çok teşekkürler!",
        time: "1 sa",
        createdAt: hoursAgo(1),
      },
    ],
  }),
  createGuestCampusPost("selinkaya", {
    id: "final-week-poll",
    detail: "Topluluk anketi",
    category: "Anket",
    title: "Final haftasında hangisisin?",
    body: "Çalışma düzenimizin bilimsel olmayan ama oldukça gerçekçi özeti.",
    poll: {
      options: [
        { id: "final-early", text: "Erkenden başlarım", votes: 32 },
        { id: "final-week", text: "Son hafta hızlanırım", votes: 81 },
        { id: "final-night", text: "Son gece", votes: 64 },
        { id: "final-calendar", text: "Takvime bakmam", votes: 18 },
      ],
    },
    time: "5 sa",
    createdAt: hoursAgo(5),
    likes: 112,
    comments: [
      {
        id: "comment-final-week-poll-mertcan",
        author: "@mertcan",
        authorId: "seed-mertcan",
        body: "Son gece kesin kaybediyor ama her sene aynı hataya düşüyorum.",
        time: "4 sa",
        createdAt: hoursAgo(4),
      },
    ],
  }),
  createGuestCampusPost("eceyilmaz", {
    id: "campus-photo-walk",
    detail: "Hafta sonu planı",
    category: "Sohbet",
    title: "Bu hafta sonu kampüsün gözden kaçan köşelerini çekelim mi",
    body: "Telefon ya da makine fark etmez, birlikte gezip fotoğraf çekmek isteyenler yazsın, rotayı beraber belirleriz.",
    image: {
      src: "/images/campus-feed/yasar-university-campus.jpg",
      width: 1200,
      height: 750,
      alt: "Yaşar Üniversitesi kampüsünden bir köşe",
    },
    time: "6 sa",
    createdAt: hoursAgo(6),
    likes: 68,
    comments: [
      {
        id: "comment-campus-photo-walk-irem",
        author: "@iremozturk",
        authorId: "irem-ozturk",
        body: "@sen geçen seferki rotayı biliyorsun, bize de katılır mısın?",
        time: "5 sa",
        createdAt: hoursAgo(5),
      },
    ],
  }),
  createGuestCampusPost("denizari", {
    id: "calculator-pool",
    detail: "Küçük bir yardım",
    category: "İlan",
    title: "Sınav haftası için ihtiyacı olana hesap makinesi bırakıyorum",
    body: "Kullanan işi bitince bir sonraki ihtiyacı olana bıraksın, böylece kimse hesap makinesiz sınava girmesin.",
    listing: {
      type: "Ücretsiz",
      condition: "Kullanılmış",
      price: 0,
    },
    time: "7 sa",
    createdAt: hoursAgo(7),
    likes: 39,
    comments: [
      {
        id: "comment-calculator-pool-canberk",
        author: "@canberk",
        authorId: "seed-canberk",
        body: "Aynı ihtiyaçtan geçen sene ben de geçtim, süper fikir.",
        time: "5 sa",
        createdAt: hoursAgo(5),
      },
    ],
  }),
  createGuestCampusPost("beril", {
    id: "question-for-graduates",
    detail: "Mezun ağı",
    category: "Soru",
    title: "Mezunlara tek bir soru sorabilsen ne sorardın?",
    body: "Staj, dersler, yurt dışı veya ilk iş… En çok merak ettiğin soruyu yaz. Öne çıkanları mezun buluşmasında yönelteceğiz.",
    time: "8 sa",
    createdAt: hoursAgo(8),
    likes: 76,
    comments: [
      {
        id: "comment-question-for-graduates-selinkaya",
        author: "@selinkaya",
        authorId: "selin-kaya",
        body: "Staj başvurusunda ne sizi öne çıkardı, onu çok merak ediyorum.",
        time: "6 sa",
        createdAt: hoursAgo(6),
      },
    ],
  }),
  createGuestCampusPost("canberk", {
    id: "shared-space-note",
    detail: "Küçük bir iyilik",
    category: "Sohbet",
    title: "Ortak alanda bırakılan şarj kablosu tam da ihtiyacım olan anda buldum",
    body: "Telefonum bitmek üzereydi, birisi masaya bir şarj kablosu bırakmış olmalı ki tam zamanında yetişti. Kim bıraktıysa gerçekten teşekkürler.",
    time: "9 sa",
    createdAt: hoursAgo(9),
    likes: 104,
    comments: [
      {
        id: "comment-shared-space-note-beril",
        author: "@beril",
        authorId: "seed-beril",
        body: "Az kalsın ben de böyle bir şey bırakacaktım, aynı fikirdeymişiz.",
        time: "7 sa",
        createdAt: hoursAgo(7),
      },
    ],
  }),
  createGuestCampusPost("iremozturk", {
    id: "campus-rules",
    detail: "Kampüs gözlemi",
    category: "Sohbet",
    title: "Kütüphanede sınav öncesi sessizlik krizi",
    body: "Herkes fısıltıyla konuşuyor ama klavye sesleri resital gibi yankılanıyor. Final stresinin gizli bir belirtisi olmalı bu.",
    time: "11 sa",
    createdAt: hoursAgo(11),
    likes: 71,
    comments: [
      {
        id: "comment-campus-rules-mert",
        author: "@mertcan",
        authorId: "seed-mertcan",
        body: "Ben de klavyemi sessiz moda aldım ama parmaklarım dinlemiyor.",
        time: "9 sa",
        createdAt: hoursAgo(9),
      },
    ],
  }),
  createGuestCampusPost("selin", {
    id: "see-you-tomorrow",
    detail: "Kampüs sorusu",
    category: "Soru",
    title: "Yemekhanede bugün ne vardı bilen var mı?",
    body: "Derse yetişeyim derken kaçırdım, sıra hâlâ var mı acaba? Kampüs yemek saatleri gerçekten yeniden düşünülmeli.",
    time: "Dün",
    createdAt: daysAgo(1),
    likes: 63,
    gif: {
      id: "3o7aCVRXjjTaLBOtvS",
      src: "https://media.giphy.com/media/3o7aCVRXjjTaLBOtvS/giphy.gif",
      width: 480,
      height: 270,
      alt: "Açlıktan bekleyen komik tepki GIF'i",
    },
    comments: [
      {
        id: "comment-see-you-tomorrow-beril",
        author: "@beril",
        authorId: "seed-beril",
        body: "Mercimek çorbası vardı, azıcık kaldıysa acele et.",
        time: "20 sa",
        createdAt: hoursAgo(20),
      },
      {
        id: "comment-see-you-tomorrow-canberk",
        author: "@canberk",
        authorId: "seed-canberk",
        body: "Ben tam kapanırken yetiştim, tabak bile zor buldum.",
        time: "18 sa",
        createdAt: hoursAgo(18),
        gif: {
          id: "l0MYt5jPR6QX5pnqM",
          src: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
          width: 480,
          height: 270,
          alt: "Eğlenceli tepki GIF'i",
        },
      },
    ],
  }),
];

const memberSeedPosts: CampusPost[] = [
  {
    id: "library-notes",
    author: "Anonim",
    isAnonymous: true,
    category: "İtiraf",
    title: "Notlarımı teslim eden kişiye teşekkür",
    body: "Bugün kütüphanede masada unuttuğum notları danışmaya bırakan kişiye teşekkür ederim. Final haftasında böyle küçük iyilikler gerçekten iyi geliyor.",
    time: "12 dk",
    createdAt: minutesAgo(12),
    likes: 27,
    liked: false,
    comments: [
      {
        id: "library-comment-1",
        author: "@deniz",
        authorId: "seed-deniz",
        avatarUrl: guestAuthors.deniz.avatarUrl,
        isAnonymous: false,
        body: "Notları danışmada görünce sahibi mutlaka arar diye düşündüm. Sana ulaştığına sevindim.",
        time: "8 dk",
        createdAt: minutesAgo(8),
      },
      {
        id: "library-comment-2",
        author: "Anonim",
        isAnonymous: true,
        body: "Final haftasında ihtiyacımız olan kampüs ruhu tam olarak bu.",
        time: "4 dk",
        createdAt: minutesAgo(4),
      },
    ],
    bookmarked: false,
  },
  {
    id: "economics-study",
    author: "@ecearslan",
    authorId: "seed-ecearslan",
    avatarUrl: guestAuthors.ecearslan.avatarUrl,
    isAnonymous: false,
    detail: "İşletme",
    category: "Soru",
    title: "Mikroekonomi finali için çalışma grubu",
    body: "Mikroekonomi finali için birlikte soru çözmek isteyen var mı? Yarın öğleden sonra kütüphanede çalışacağım.",
    time: "34 dk",
    createdAt: minutesAgo(34),
    likes: 11,
    liked: false,
    comments: [
      {
        id: "economics-comment-1",
        author: "@mertcan",
        authorId: "seed-mertcan",
        avatarUrl: guestAuthors.mertcan.avatarUrl,
        isAnonymous: false,
        body: "Saat 14.00 gibi gelebilirim. Özellikle esneklik konusuna çalışmam gerekiyor.",
        time: "20 dk",
        createdAt: minutesAgo(20),
      },
      {
        id: "economics-comment-2",
        author: "@selin",
        authorId: "seed-selin",
        avatarUrl: guestAuthors.selin.avatarUrl,
        isAnonymous: false,
        body: "Ben de katılırım, grup olursa daha verimli olur.",
        time: "11 dk",
        createdAt: minutesAgo(11),
      },
      {
        id: "economics-comment-3",
        author: "@ecearslan",
        authorId: "seed-ecearslan",
        avatarUrl: guestAuthors.ecearslan.avatarUrl,
        isAnonymous: false,
        body: "14.00'te kütüphanenin girişindeki masalarda buluşalım.",
        time: "6 dk",
        createdAt: minutesAgo(6),
      },
    ],
    bookmarked: false,
  },
  {
    id: "black-thermos",
    author: "@canberk",
    authorId: "seed-canberk",
    avatarUrl: guestAuthors.canberk.avatarUrl,
    isAnonymous: false,
    detail: "Kampüs",
    category: "Kayıp Eşya",
    title: "C blokta siyah termos bulundu",
    body: "C blok ikinci kattaki prizlerin yanında siyah bir termos buldum. Güvenliğe teslim ettim.",
    time: "1 sa",
    createdAt: hoursAgo(1),
    likes: 18,
    liked: false,
    comments: [
      {
        id: "thermos-comment-1",
        author: "@beril",
        authorId: "seed-beril",
        avatarUrl: guestAuthors.beril.avatarUrl,
        isAnonymous: false,
        body: "Üzerinde küçük beyaz bir çıkartma varsa arkadaşımın olabilir, haber veriyorum.",
        time: "42 dk",
        createdAt: minutesAgo(42),
      },
    ],
    bookmarked: false,
  },
];

export const campusPosts: CampusPost[] = [
  ...guestCampusPosts,
  ...memberSeedPosts,
];

export function getCampusPost(postId: string) {
  return campusPosts.find((post) => post.id === postId);
}
