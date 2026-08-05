import type { Metadata } from "next";

import CampusCommentThread from "@/components/CampusCommentThread";

export const metadata: Metadata = {
  title: "Yanıtlar | KAMPÜS.",
  description: "Yoruma verilen yanıtları görüntüle ve sohbete katıl.",
};

export default async function CommentThreadPage({
  params,
}: {
  params: Promise<{ postId: string; commentId: string }>;
}) {
  const { postId, commentId } = await params;

  return <CampusCommentThread postId={postId} commentId={commentId} />;
}
