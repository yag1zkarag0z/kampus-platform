import { guestAuthors } from "@/data/campusPosts";
import type {
  DirectConversationDto,
  DirectMessageDto,
} from "@/messaging/client";

export type GuestDirectConversation = DirectConversationDto & {
  messages: DirectMessageDto[];
};

const minutesAgoIso = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

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
      id: "guest-message-ece-3",
      preview: "Notları yükledim, göz atarsın.",
      isMine: false,
      createdAt: minutesAgoIso(4),
    },
    unreadCount: 1,
    createdAt: minutesAgoIso(24),
    messages: [
      {
        id: "guest-message-ece-1",
        conversationId: "guest-conversation-ece",
        body: "Selam, geçen haftaki arayüz notları sende miydi?",
        isMine: true,
        isDeleted: false,
        createdAt: minutesAgoIso(24),
      },
      {
        id: "guest-message-ece-2",
        conversationId: "guest-conversation-ece",
        body: "Evet, düzenleyip birazdan gönderiyorum.",
        isMine: false,
        isDeleted: false,
        createdAt: minutesAgoIso(18),
      },
      {
        id: "guest-message-ece-3",
        conversationId: "guest-conversation-ece",
        body: "Notları yükledim, göz atarsın.",
        isMine: false,
        isDeleted: false,
        createdAt: minutesAgoIso(4),
      },
    ],
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
      id: "guest-message-mert-3",
      preview: "Yarın 14.00’te kütüphanedeyiz.",
      isMine: false,
      createdAt: minutesAgoIso(31),
    },
    unreadCount: 1,
    createdAt: minutesAgoIso(72),
    messages: [
      {
        id: "guest-message-mert-1",
        conversationId: "guest-conversation-mert",
        body: "Veri yapıları için birlikte çalışacak mıyız?",
        isMine: false,
        isDeleted: false,
        createdAt: minutesAgoIso(72),
      },
      {
        id: "guest-message-mert-2",
        conversationId: "guest-conversation-mert",
        body: "Olur, saat netleşince haber ver.",
        isMine: true,
        isDeleted: false,
        createdAt: minutesAgoIso(65),
      },
      {
        id: "guest-message-mert-3",
        conversationId: "guest-conversation-mert",
        body: "Yarın 14.00’te kütüphanedeyiz.",
        isMine: false,
        isDeleted: false,
        createdAt: minutesAgoIso(31),
      },
    ],
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
      id: "guest-message-deniz-2",
      preview: "Kulüp tanıtımları avluda başladı.",
      isMine: false,
      createdAt: minutesAgoIso(96),
    },
    unreadCount: 1,
    createdAt: minutesAgoIso(135),
    messages: [
      {
        id: "guest-message-deniz-1",
        conversationId: "guest-conversation-deniz",
        body: "Bugün kampüste etkinlik var mı?",
        isMine: true,
        isDeleted: false,
        createdAt: minutesAgoIso(135),
      },
      {
        id: "guest-message-deniz-2",
        conversationId: "guest-conversation-deniz",
        body: "Kulüp tanıtımları avluda başladı.",
        isMine: false,
        isDeleted: false,
        createdAt: minutesAgoIso(96),
      },
    ],
  },
];

export const guestUnreadMessageCount = guestDirectConversations.reduce(
  (total, conversation) => total + conversation.unreadCount,
  0,
);
