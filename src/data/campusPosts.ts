export type CampusPostCategory =
  | "İtiraf"
  | "Soru"
  | "Etkinlik"
  | "Kayıp Eşya";

export type CampusComment = {
  id: string;
  author: string;
  body: string;
  time: string;
};

export type CampusPost = {
  id: string;
  author: string;
  detail?: string;
  category: CampusPostCategory;
  title: string;
  body: string;
  time: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  comments: CampusComment[];
  bookmarked: boolean;
};

export const campusPosts: CampusPost[] = [
  {
    id: "library-notes",
    author: "Anonim",
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
        body: "Notları danışmada görünce sahibi mutlaka arar diye düşündüm. Sana ulaştığına sevindim.",
        time: "8 dk",
      },
      {
        id: "library-comment-2",
        author: "Anonim",
        body: "Final haftasında ihtiyacımız olan kampüs ruhu tam olarak bu.",
        time: "4 dk",
      },
    ],
    bookmarked: false,
  },
  {
    id: "economics-study",
    author: "@ecearslan",
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
        body: "Saat 14.00 gibi gelebilirim. Özellikle esneklik konusuna çalışmam gerekiyor.",
        time: "20 dk",
      },
      {
        id: "economics-comment-2",
        author: "@selin",
        body: "Ben de katılırım, grup olursa daha verimli olur.",
        time: "11 dk",
      },
      {
        id: "economics-comment-3",
        author: "@ecearslan",
        body: "14.00'te kütüphanenin girişindeki masalarda buluşalım.",
        time: "6 dk",
      },
    ],
    bookmarked: false,
  },
  {
    id: "black-thermos",
    author: "@canberk",
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
