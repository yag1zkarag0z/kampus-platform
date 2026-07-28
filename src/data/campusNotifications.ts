export type CampusNotificationKind =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "announcement";

export type CampusNotification = {
  id: string;
  kind: CampusNotificationKind;
  actor: {
    name: string;
    id: string;
    username?: string;
  };
  action: string;
  preview: string;
  postId?: string;
  commentId?: string;
  postTitle?: string;
  time: string;
  initiallyRead: boolean;
};

export const campusNotifications: CampusNotification[] = [
  {
    id: "notification-follow-mertcan",
    kind: "follow",
    actor: {
      name: "Mert Can",
      id: "seed-mertcan",
      username: "mertcan",
    },
    action: "seni takip etmeye başladı.",
    preview: "@mertcan artık paylaşımlarını takip ediyor.",
    time: "Şimdi",
    initiallyRead: false,
  },
  {
    id: "notification-comment-library",
    kind: "comment",
    actor: { name: "Ece Yılmaz", id: "ece-yilmaz" },
    action: "gönderine yorum yaptı:",
    preview: "Notları PDF olarak da paylaşabilir misin? Çok işime yarar.",
    postId: "best-study-spot",
    commentId: "comment-best-study-spot-ece",
    postTitle: "Kampüste en iyi çalışma köşesi neresi?",
    time: "4 dk",
    initiallyRead: false,
  },
  {
    id: "notification-mention-study",
    kind: "mention",
    actor: { name: "Deniz Arı", id: "deniz-ari" },
    action: "bir yorumda senden bahsetti:",
    preview: "@sen geçen hafta bu hocanın kaynaklarını bulmuştun, değil mi?",
    postId: "study-buddy",
    commentId: "comment-study-buddy-deniz",
    postTitle: "Bu hafta birlikte çalışmak isteyen var mı?",
    time: "18 dk",
    initiallyRead: false,
  },
  {
    id: "notification-like-study",
    kind: "like",
    actor: { name: "Mert ve 12 kişi", id: "mert-and-others" },
    action: "gönderini beğendi.",
    preview: "Final haftası için birlikte çalışma alanı",
    postId: "open-study-session",
    postTitle: "Final haftası için birlikte çalışma alanı",
    time: "36 dk",
    initiallyRead: false,
  },
  {
    id: "notification-reply-thermos",
    kind: "reply",
    actor: { name: "Selin Kaya", id: "selin-kaya" },
    action: "yorumuna yanıt verdi:",
    preview:
      "Evet, danışmaya bıraktım. Öğrenci kartını göstererek alabilirsin.",
    postId: "lost-blue-bottle",
    commentId: "comment-lost-blue-bottle-selin",
    postTitle: "Mavi matara güvenliğe teslim edildi",
    time: "1 sa",
    initiallyRead: false,
  },
  {
    id: "notification-announcement-rules",
    kind: "announcement",
    actor: { name: "KAMPÜS", id: "campus-official" },
    action: "topluluk kurallarını güncelledi.",
    preview:
      "Yeni şikâyet ve engelleme seçenekleriyle güvenli alanı birlikte koruyoruz.",
    postId: "campus-rules",
    postTitle: "KAMPÜS topluluk kuralları",
    time: "2 sa",
    initiallyRead: false,
  },
  {
    id: "notification-comment-workshop",
    kind: "comment",
    actor: { name: "Teknoloji Topluluğu", id: "technology-club" },
    action: "takip ettiğin konuya yeni bilgi ekledi:",
    preview: "Kontenjan 40 kişiye çıkarıldı; kayıt formu akşama kadar açık.",
    postId: "coding-workshop",
    commentId: "comment-coding-workshop-club",
    postTitle: "Hafta sonu kodlama atölyesi",
    time: "3 sa",
    initiallyRead: true,
  },
  {
    id: "notification-mention-photo",
    kind: "mention",
    actor: { name: "İrem Öztürk", id: "irem-ozturk" },
    action: "fotoğraf yürüyüşünde senden bahsetti:",
    preview: "@sen geçen seferki rotayı biliyorsun, bize de katılır mısın?",
    postId: "campus-photo-walk",
    commentId: "comment-campus-photo-walk-irem",
    postTitle: "Kampüs fotoğraf yürüyüşü",
    time: "5 sa",
    initiallyRead: true,
  },
  {
    id: "notification-like-question",
    kind: "like",
    actor: { name: "Zeynep ve 7 kişi", id: "zeynep-and-others" },
    action: "yorumunu faydalı buldu.",
    preview: "Mezunlara staj ve ilk iş hakkında soru",
    postId: "question-for-graduates",
    postTitle: "Mezunlara bir soru",
    time: "Dün",
    initiallyRead: true,
  },
  {
    id: "notification-reply-cafe",
    kind: "reply",
    actor: { name: "Bora Demir", id: "bora-demir" },
    action: "önerine yanıt verdi:",
    preview: "Üst kattaki masalarda priz de varmış, bugün denedim.",
    postId: "campus-cafe-spots",
    commentId: "comment-campus-cafe-bora",
    postTitle: "Kampüs çevresinde çalışılacak kafeler",
    time: "Dün",
    initiallyRead: true,
  },
];
