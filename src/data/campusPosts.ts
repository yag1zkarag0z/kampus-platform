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
  id: string;
  author: string;
  authorId?: string;
  isAnonymous?: boolean;
  parentId?: string;
  edited?: boolean;
  isDeleted?: boolean;
  body: string;
  time: string;
};

export type CampusPostImage = {
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
  isAnonymous?: boolean;
  detail?: string;
  category: CampusPostCategory;
  title: string;
  body: string;
  image?: CampusPostImage;
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

type OfficialCampusPostSeed = Omit<
  CampusPost,
  | "author"
  | "authorId"
  | "isAnonymous"
  | "liked"
  | "comments"
  | "bookmarked"
> & {
  comments?: CampusComment[];
};

function createOfficialCampusPost({
  comments = [],
  ...post
}: OfficialCampusPostSeed): CampusPost {
  return {
    ...post,
    author: "KAMPÜS",
    authorId: CAMPUS_OFFICIAL_AUTHOR_ID,
    isAnonymous: false,
    liked: false,
    comments,
    bookmarked: false,
  };
}

export const guestCampusPosts: CampusPost[] = [
  createOfficialCampusPost({
    id: "campus-welcome",
    detail: "Platform duyurusu",
    category: "Etkinlik",
    title: "KAMPÜS’e hoş geldin",
    body: "Kampüste konuşulanları, öğrenci duyurularını ve günün öne çıkanlarını burada bulabilirsin. Misafir görünümünde akışı inceleyebilir, üye olduğunda sohbete katılabilirsin.",
    image: {
      src: "/images/campus-feed/campus-courtyard.jpg",
      width: 1200,
      height: 750,
      alt: "Güneşli bir günde modern bir üniversite kampüsü",
    },
    time: "Şimdi",
    createdAt: 200,
    likes: 84,
  }),
  createOfficialCampusPost({
    id: "campus-today",
    detail: "Günün karesi",
    category: "Etkinlik",
    title: "Bugün kampüsten kısa bir kare",
    body: "Ders arası kampüs yolu her zamanki gibi hareketli. Gün içinde yakaladığın kareleri üye olduğunda toplulukla paylaşabilirsin.",
    image: {
      src: "/images/campus-feed/campus-walkway.jpg",
      width: 1200,
      height: 750,
      alt: "Ağaçların arasındaki kampüs yolunda yürüyen öğrenciler",
    },
    time: "8 dk",
    createdAt: 199,
    likes: 46,
  }),
  createOfficialCampusPost({
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
    createdAt: 198,
    likes: 61,
    comments: [
      {
        id: "comment-best-study-spot-ece",
        author: "@eceyilmaz",
        authorId: "ece-yilmaz",
        body: "Notları PDF olarak da paylaşabilir misin? Çok işime yarar.",
        time: "4 dk",
      },
    ],
  }),
  createOfficialCampusPost({
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
    createdAt: 197,
    likes: 93,
  }),
  createOfficialCampusPost({
    id: "club-meetups",
    detail: "Kulüp duyurusu",
    category: "Etkinlik",
    title: "Kulüp tanışmalarına uğramayı unutma",
    body: "Yeni insanlarla tanışmak ve dönem boyunca yapılacak etkinlikleri görmek için kulüp buluşmalarına göz atabilirsin.",
    image: {
      src: "/images/campus-feed/campus-conversation.jpg",
      width: 1200,
      height: 750,
      alt: "Kampüs binasının önünde konuşan iki öğrenci",
    },
    time: "47 dk",
    createdAt: 196,
    likes: 72,
  }),
  createOfficialCampusPost({
    id: "community-thanks",
    detail: "Topluluktan",
    category: "İtiraf",
    title: "Topluluktan küçük bir teşekkür",
    body: "Kütüphanede unutulan notları danışmaya bırakan kişiye teşekkürler. Final haftasında böyle küçük yardımlar gerçekten fark yaratıyor.",
    time: "1 sa",
    createdAt: 195,
    likes: 128,
  }),
  createOfficialCampusPost({
    id: "coding-workshop",
    detail: "Atölye",
    category: "Etkinlik",
    title: "Kodlama atölyesinde bu hafta arayüz geliştiriyoruz",
    body: "Temel HTML ve CSS bilgisi yeterli. Bilgisayarını getirmen iyi olur; ilk kez katılacaklar için başlangıç masası da olacak.",
    image: {
      src: "/images/campus-feed/coding-workshop.jpg",
      width: 1200,
      height: 750,
      alt: "Bilgisayarlarıyla kodlama atölyesinde çalışan öğrenciler",
    },
    time: "1 sa",
    createdAt: 194,
    likes: 65,
    comments: [
      {
        id: "comment-coding-workshop-club",
        author: "@teknolojitoplulugu",
        authorId: "technology-club",
        body: "Kontenjan 40 kişiye çıkarıldı; kayıt formu akşama kadar açık.",
        time: "3 sa",
      },
    ],
  }),
  createOfficialCampusPost({
    id: "design-book-listing",
    detail: "Öğrenci ilanı",
    category: "İlan",
    title: "Temel Tasarım kitabı yeni sahibini arıyor",
    body: "Kitap temiz durumda. Yalnızca birkaç sayfada kurşun kalemle küçük notlar var.",
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
    createdAt: 193,
    likes: 24,
  }),
  createOfficialCampusPost({
    id: "open-study-session",
    detail: "Açık çalışma",
    category: "Etkinlik",
    title: "Öğleden sonra ortak çalışma oturumu var",
    body: "Konu fark etmiyor; aynı masada sessizce çalışıp mola saatlerini birlikte ayarlayacağız. Katılmak isteyenler 14.00’te çalışma salonunda buluşabilir.",
    image: {
      src: "/images/campus-feed/classroom-study.jpg",
      width: 1200,
      height: 750,
      alt: "Aynı sınıfta ders çalışan bir grup öğrenci",
    },
    time: "2 sa",
    createdAt: 192,
    likes: 97,
  }),
  createOfficialCampusPost({
    id: "study-buddy",
    detail: "Çalışma grubu",
    category: "Soru",
    title: "Bu hafta birlikte çalışmak isteyen var mı?",
    body: "Aynı derse çalışan öğrencilerin birbirini bulabilmesi için dersin adını ve uygun olduğun saati yazabilirsin.",
    time: "3 sa",
    createdAt: 191,
    likes: 42,
    comments: [
      {
        id: "comment-study-buddy-deniz",
        author: "@denizari",
        authorId: "deniz-ari",
        body: "@sen geçen hafta bu hocanın kaynaklarını bulmuştun, değil mi?",
        time: "18 dk",
      },
    ],
  }),
  createOfficialCampusPost({
    id: "technology-club",
    detail: "Kulüp duyurusu",
    category: "Etkinlik",
    title: "Teknoloji kulübünde proje masası kuruluyor",
    body: "Devre, yazılım veya tasarım fark etmez. Üzerinde çalıştığın fikri getir; ekip arayanlarla proje arayanları aynı masada buluşturacağız.",
    image: {
      src: "/images/campus-feed/technology-workshop.jpg",
      width: 1200,
      height: 750,
      alt: "Elektronik proje üzerinde çalışan öğrenciler",
    },
    time: "3 sa",
    createdAt: 190,
    likes: 88,
  }),
  createOfficialCampusPost({
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
    createdAt: 189,
    likes: 53,
    comments: [
      {
        id: "comment-campus-cafe-bora",
        author: "@borademir",
        authorId: "bora-demir",
        body: "Üst kattaki masalarda priz de varmış, bugün denedim.",
        time: "Dün",
      },
    ],
  }),
  createOfficialCampusPost({
    id: "lost-blue-bottle",
    detail: "Kayıp eşya",
    category: "Kayıp Eşya",
    title: "Mavi matara güvenliğe teslim edildi",
    body: "C blok ikinci kattaki oturma alanında bulundu. Üzerindeki küçük etiketi tarif eden kişi güvenlikten teslim alabilir.",
    time: "4 sa",
    createdAt: 188,
    likes: 31,
    comments: [
      {
        id: "comment-lost-blue-bottle-selin",
        author: "@selinkaya",
        authorId: "selin-kaya",
        body: "Evet, danışmaya bıraktım. Öğrenci kartını göstererek alabilirsin.",
        time: "1 sa",
      },
    ],
  }),
  createOfficialCampusPost({
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
    createdAt: 187,
    likes: 112,
  }),
  createOfficialCampusPost({
    id: "campus-photo-walk",
    detail: "Topluluk etkinliği",
    category: "Etkinlik",
    title: "Kampüs fotoğraf yürüyüşü",
    body: "Telefon ya da fotoğraf makinesi fark etmez. Kampüsün gözden kaçan köşelerini birlikte çekmek isteyenleri bekliyoruz.",
    image: {
      src: "/images/campus-feed/campus-autumn.jpg",
      width: 1200,
      height: 750,
      alt: "Sonbaharda kampüs yolunda yürüyen bir öğrenci",
    },
    time: "6 sa",
    createdAt: 186,
    likes: 68,
    comments: [
      {
        id: "comment-campus-photo-walk-irem",
        author: "@iremozturk",
        authorId: "irem-ozturk",
        body: "@sen geçen seferki rotayı biliyorsun, bize de katılır mısın?",
        time: "5 sa",
      },
    ],
  }),
  createOfficialCampusPost({
    id: "calculator-pool",
    detail: "Dayanışma ilanı",
    category: "İlan",
    title: "Hesap makinesi emanet havuzu",
    body: "Sınav haftasında kısa süreliğine bilimsel hesap makinesine ihtiyacı olanlar kullanabilir. İşin bitince başka bir öğrenciye bırakman yeterli.",
    listing: {
      type: "Ücretsiz",
      condition: "Kullanılmış",
      price: 0,
    },
    time: "7 sa",
    createdAt: 185,
    likes: 39,
  }),
  createOfficialCampusPost({
    id: "question-for-graduates",
    detail: "Mezun ağı",
    category: "Soru",
    title: "Mezunlara tek bir soru sorabilsen ne sorardın?",
    body: "Staj, dersler, yurt dışı veya ilk iş… En çok merak ettiğin soruyu yaz. Öne çıkanları mezun buluşmasında yönelteceğiz.",
    time: "8 sa",
    createdAt: 184,
    likes: 76,
  }),
  createOfficialCampusPost({
    id: "shared-space-note",
    detail: "Ortak alan notu",
    category: "Sohbet",
    title: "Şarj kablosunu bırakan gizli kahraman",
    body: "Ortak çalışma alanına herkes kullansın diye bir şarj kablosu bırakan kişiye topluluk adına teşekkürler.",
    time: "9 sa",
    createdAt: 183,
    likes: 104,
  }),
  createOfficialCampusPost({
    id: "campus-rules",
    detail: "Topluluk notu",
    category: "Etkinlik",
    title: "Burada herkes için yer var",
    body: "Kişisel bilgi paylaşmadan, hakaret etmeden ve kampüs topluluğuna saygı göstererek konuş. Üye olduğunda konu açabilir, yorum yapabilir ve gönderileri kaydedebilirsin.",
    time: "11 sa",
    createdAt: 182,
    likes: 55,
  }),
  createOfficialCampusPost({
    id: "see-you-tomorrow",
    detail: "Gün sonu",
    category: "Etkinlik",
    title: "Bugünün akışından bu kadar",
    body: "Kampüs sakinleşirken günün duyurularını burada kapatıyoruz. Yeni etkinlikler ve öğrenci gündemiyle yarın görüşürüz.",
    time: "Dün",
    createdAt: 181,
    likes: 89,
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
    createdAt: 3,
    likes: 27,
    liked: false,
    comments: [
      {
        id: "library-comment-1",
        author: "@deniz",
        authorId: "seed-deniz",
        isAnonymous: false,
        body: "Notları danışmada görünce sahibi mutlaka arar diye düşündüm. Sana ulaştığına sevindim.",
        time: "8 dk",
      },
      {
        id: "library-comment-2",
        author: "Anonim",
        isAnonymous: true,
        body: "Final haftasında ihtiyacımız olan kampüs ruhu tam olarak bu.",
        time: "4 dk",
      },
    ],
    bookmarked: false,
  },
  {
    id: "economics-study",
    author: "@ecearslan",
    authorId: "seed-ecearslan",
    isAnonymous: false,
    detail: "İşletme",
    category: "Soru",
    title: "Mikroekonomi finali için çalışma grubu",
    body: "Mikroekonomi finali için birlikte soru çözmek isteyen var mı? Yarın öğleden sonra kütüphanede çalışacağım.",
    time: "34 dk",
    createdAt: 2,
    likes: 11,
    liked: false,
    comments: [
      {
        id: "economics-comment-1",
        author: "@mertcan",
        authorId: "seed-mertcan",
        isAnonymous: false,
        body: "Saat 14.00 gibi gelebilirim. Özellikle esneklik konusuna çalışmam gerekiyor.",
        time: "20 dk",
      },
      {
        id: "economics-comment-2",
        author: "@selin",
        authorId: "seed-selin",
        isAnonymous: false,
        body: "Ben de katılırım, grup olursa daha verimli olur.",
        time: "11 dk",
      },
      {
        id: "economics-comment-3",
        author: "@ecearslan",
        authorId: "seed-ecearslan",
        isAnonymous: false,
        body: "14.00'te kütüphanenin girişindeki masalarda buluşalım.",
        time: "6 dk",
      },
    ],
    bookmarked: false,
  },
  {
    id: "black-thermos",
    author: "@canberk",
    authorId: "seed-canberk",
    isAnonymous: false,
    detail: "Kampüs",
    category: "Kayıp Eşya",
    title: "C blokta siyah termos bulundu",
    body: "C blok ikinci kattaki prizlerin yanında siyah bir termos buldum. Güvenliğe teslim ettim.",
    time: "1 sa",
    createdAt: 1,
    likes: 18,
    liked: false,
    comments: [
      {
        id: "thermos-comment-1",
        author: "@beril",
        authorId: "seed-beril",
        isAnonymous: false,
        body: "Üzerinde küçük beyaz bir çıkartma varsa arkadaşımın olabilir, haber veriyorum.",
        time: "42 dk",
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
