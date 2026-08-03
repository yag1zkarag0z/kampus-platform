import type { NotificationDto } from "@/notifications/client";

export function getNotificationCopy(notification: NotificationDto): {
  actorLabel: string;
  action: string;
  preview: string;
  postTitle: string | null;
} {
  switch (notification.kind) {
    case "like": {
      const others = (notification.likeCount ?? 1) - 1;

      return {
        actorLabel:
          others > 0
            ? `${notification.actor.displayName} ve ${others} kişi`
            : notification.actor.displayName,
        action: "gönderini beğendi.",
        preview: notification.post?.isDeleted
          ? "Gönderi silindi."
          : (notification.post?.title ?? ""),
        postTitle: null,
      };
    }
    case "comment":
      return {
        actorLabel: notification.actor.displayName,
        action: "gönderine yorum yaptı:",
        preview: notification.comment?.excerpt ?? "",
        postTitle: notification.post?.title || null,
      };
    case "reply":
      return {
        actorLabel: notification.actor.displayName,
        action: "yorumuna yanıt verdi:",
        preview: notification.comment?.excerpt ?? "",
        postTitle: notification.post?.title || null,
      };
    case "mention":
      return {
        actorLabel: notification.actor.displayName,
        action: "bir yorumda senden bahsetti:",
        preview: notification.comment?.excerpt ?? "",
        postTitle: notification.post?.title || null,
      };
    case "follow":
      return {
        actorLabel: notification.actor.displayName,
        action: "seni takip etmeye başladı.",
        preview: `@${notification.actor.username} artık paylaşımlarını takip ediyor.`,
        postTitle: null,
      };
    case "announcement":
      return {
        actorLabel: notification.actor.displayName,
        action: "bir duyuru paylaştı.",
        preview: notification.post?.title ?? "",
        postTitle: null,
      };
  }
}
