import type { Metadata } from "next";

import CampusPostDetail from "@/components/CampusPostDetail";
import { campusPosts, getCampusPost } from "@/data/campusPosts";

type PostDetailPageProps = {
  params: Promise<{ postId: string }>;
};

export function generateStaticParams() {
  return campusPosts.map((post) => ({ postId: post.id }));
}

export async function generateMetadata({
  params,
}: PostDetailPageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = getCampusPost(postId);

  if (!post) {
    return {
      title: "Kampüs Konusu | KAMPÜS.",
      description: "KAMPÜS topluluğunda paylaşılan öğrenci konusu.",
    };
  }

  return {
    title: `${post.title} | KAMPÜS.`,
    description: post.body,
  };
}

export default async function PostDetailPage({
  params,
}: PostDetailPageProps) {
  const { postId } = await params;
  return <CampusPostDetail postId={postId} />;
}
