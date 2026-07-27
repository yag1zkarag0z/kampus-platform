import type { Metadata } from "next";

import CampusMemberProfile from "@/components/CampusMemberProfile";
import { normalizeCampusProfileUsername } from "@/components/CampusAuthorProfileLink";

type MemberProfilePageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: MemberProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const normalizedUsername =
    normalizeCampusProfileUsername(username).slice(0, 40) || "kullanici";

  return {
    title: `@${normalizedUsername} | KAMPÜS.`,
    description: `@${normalizedUsername} kullanıcısının KAMPÜS topluluk profili, gönderileri ve yorumları.`,
  };
}

export default async function MemberProfilePage({
  params,
}: MemberProfilePageProps) {
  const { username } = await params;

  return <CampusMemberProfile username={username} />;
}
