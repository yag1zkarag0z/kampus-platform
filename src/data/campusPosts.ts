export type CampusPostCategory =
  | "İtiraf"
  | "Soru"
  | "Etkinlik"
  | "Kayıp Eşya"
  | "Anket"
  | "İlan";

export const LOCAL_ACCOUNT_OWNER_ID = "local-current-account";

export type CampusComment = {
  id: string;
  author: string;
  authorId?: string;
  isAnonymous?: boolean;
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
  bookmarked: boolean;
};

export type CampusAuthorReference = {
  author: string;
  authorId?: string;
  isAnonymous?: boolean;
};

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

export const campusPosts: CampusPost[] = [
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

export function getCampusPost(postId: string) {
  return campusPosts.find((post) => post.id === postId);
}
