import type { Metadata } from "next";

import CampusCommentCompose from "@/components/CampusCommentCompose";

export const metadata: Metadata = {
  title: "Yorum yaz | KAMPÜS.",
  description: "Gönderiye yorum yaz ve kampüs sohbetine katıl.",
};

export default async function CommentComposePage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return <CampusCommentCompose postId={postId} />;
}
