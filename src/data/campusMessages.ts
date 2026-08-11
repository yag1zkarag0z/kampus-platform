import { guestAuthors } from "@/data/campusPosts";
import type {
  DirectConversationDto,
  DirectMessageDto,
} from "@/messaging/client";

export type GuestDirectMessage = DirectMessageDto & {
  deliveryStatus?: "sent" | "sending" | "failed";
};

export type GuestDirectConversation = DirectConversationDto & {
  messages: GuestDirectMessage[];
};

const minutesAgoIso = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function createMessages(
  conversationId: string,
  rows: Array<{
    id: string;
    body: string;
    isMine: boolean;
    minutesAgo: number;
    isSeen?: boolean;
    deliveryStatus?: GuestDirectMessage["deliveryStatus"];
  }>,
) {
  return rows.map<GuestDirectMessage>((row) => ({
    id: `${conversationId}-${row.id}`,
    conversationId,
    body: row.body,
    isMine: row.isMine,
    isDeleted: false,
    isSeen: row.isSeen,
    deliveryStatus: row.deliveryStatus,
    createdAt: minutesAgoIso(row.minutesAgo),
  }));
}

const eceMessages = createMessages("guest-conversation-ece", [
  {
    id: "01",
    body: "Yarınki sunum için konu dağılımını netleştirelim mi?",
    isMine: false,
    minutesAgo: 1_560,
  },
  {
    id: "02",
    body: "Olur, akşam notları toparlayayım.",
    isMine: true,
    minutesAgo: 1_552,
    isSeen: true,
  },
  {
    id: "03",
    body: "Arayüz araştırması bende.",
    isMine: false,
    minutesAgo: 58,
  },
  {
    id: "04",
    body: "Kullanıcı akışını da ekliyorum.",
    isMine: false,
    minutesAgo: 56,
  },
  {
    id: "05",
    body: "Süper, ben de veri kısmını hazırlıyorum.",
    isMine: true,
    minutesAgo: 52,
    isSeen: true,
  },
  {
    id: "06",
    body: "Örnek ekranları buldum.",
    isMine: false,
    minutesAgo: 48,
  },
  {
    id: "07",
    body: "Birazdan ortak klasöre atacağım.",
    isMine: false,
    minutesAgo: 47,
  },
  {
    id: "08",
    body: "Tamamdır.",
    isMine: true,
    minutesAgo: 43,
    isSeen: true,
  },
  {
    id: "09",
    body: "Kapak sayfası için sade bir şey yaptım.",
    isMine: false,
    minutesAgo: 38,
  },
  {
    id: "10",
    body: "Turuncu vurguyu koruyalım bence.",
    isMine: false,
    minutesAgo: 36,
  },
  {
    id: "11",
    body: "Aynen, temayla daha uyumlu olur.",
    isMine: true,
    minutesAgo: 32,
    isSeen: true,
  },
  {
    id: "12",
    body: "Başlıkları da kısalttım.",
    isMine: false,
    minutesAgo: 27,
  },
  {
    id: "13",
    body: "Sunum kaç dakika olacakmış?",
    isMine: true,
    minutesAgo: 23,
    isSeen: true,
  },
  {
    id: "14",
    body: "Hoca on dakika dedi.",
    isMine: false,
    minutesAgo: 20,
  },
  {
    id: "15",
    body: "Son iki dakikayı sorulara bırakalım.",
    isMine: false,
    minutesAgo: 19,
  },
  {
    id: "16",
    body: "Mantıklı, prova yaparız.",
    isMine: true,
    minutesAgo: 14,
    isSeen: true,
  },
  {
    id: "17",
    body: "Selam, geçen haftaki arayüz notları sende miydi?",
    isMine: true,
    minutesAgo: 9,
    isSeen: true,
  },
  {
    id: "18",
    body: "Notları yükledim, göz atarsın.",
    isMine: false,
    minutesAgo: 4,
  },
]);

const mertMessages = createMessages("guest-conversation-mert", [
  {
    id: "01",
    body: "Veri yapıları için birlikte çalışacak mıyız?",
    isMine: false,
    minutesAgo: 1_510,
  },
  {
    id: "02",
    body: "Olur, saat netleşince haber ver.",
    isMine: true,
    minutesAgo: 1_503,
    isSeen: true,
  },
  {
    id: "03",
    body: "Yarın 14.00’te kütüphanedeyiz.",
    isMine: false,
    minutesAgo: 34,
  },
  {
    id: "04",
    body: "Tamam, üst katta buluşalım.",
    isMine: true,
    minutesAgo: 31,
    isSeen: true,
  },
]);

const denizMessages = createMessages("guest-conversation-deniz", [
  {
    id: "01",
    body: "Bugün kampüste etkinlik var mı?",
    isMine: true,
    minutesAgo: 135,
    isSeen: true,
  },
  {
    id: "02",
    body: "Kulüp tanıtımları avluda başladı.",
    isMine: false,
    minutesAgo: 96,
  },
  {
    id: "03",
    body: "Konumu gruba atıyorum.",
    isMine: true,
    minutesAgo: 91,
    deliveryStatus: "sending",
  },
  {
    id: "04",
    body: "Fotoğrafı da göndereyim.",
    isMine: true,
    minutesAgo: 88,
    deliveryStatus: "failed",
  },
]);

export const guestDirectConversations: GuestDirectConversation[] = [
  {
    id: "guest-conversation-ece",
    member: {
      id: guestAuthors.ecearslan.authorId,
      username: "ecearslan",
      displayName: "Ece Arslan",
      avatarUrl: guestAuthors.ecearslan.avatarUrl,
    },
    lastMessage: {
      id: eceMessages.at(-1)!.id,
      preview: eceMessages.at(-1)!.body,
      isMine: false,
      createdAt: eceMessages.at(-1)!.createdAt,
    },
    unreadCount: 1,
    requestStatus: "accepted",
    requestDirection: null,
    createdAt: minutesAgoIso(1_560),
    messages: eceMessages,
  },
  {
    id: "guest-conversation-mert",
    member: {
      id: guestAuthors.mertcan.authorId,
      username: "mertcan",
      displayName: "Mert Can",
      avatarUrl: guestAuthors.mertcan.avatarUrl,
    },
    lastMessage: {
      id: mertMessages.at(-1)!.id,
      preview: mertMessages.at(-1)!.body,
      isMine: true,
      createdAt: mertMessages.at(-1)!.createdAt,
    },
    unreadCount: 0,
    requestStatus: "accepted",
    requestDirection: null,
    createdAt: minutesAgoIso(1_510),
    messages: mertMessages,
  },
  {
    id: "guest-conversation-deniz",
    member: {
      id: guestAuthors.deniz.authorId,
      username: "deniz",
      displayName: "Deniz Akın",
      avatarUrl: guestAuthors.deniz.avatarUrl,
    },
    lastMessage: {
      id: denizMessages.at(-1)!.id,
      preview: denizMessages.at(-1)!.body,
      isMine: true,
      createdAt: denizMessages.at(-1)!.createdAt,
    },
    unreadCount: 2,
    requestStatus: "accepted",
    requestDirection: null,
    createdAt: minutesAgoIso(135),
    messages: denizMessages,
  },
];

export const guestUnreadMessageCount = guestDirectConversations.reduce(
  (total, conversation) => total + conversation.unreadCount,
  0,
);
