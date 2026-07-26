import type { Metadata } from "next";

import CreateCampusPost from "@/components/CreateCampusPost";

export const metadata: Metadata = {
  title: "Konu Aç | KAMPÜS.",
  description:
    "Kampüs topluluğuna bir soru, itiraf, etkinlik veya kayıp eşya konusu ekle.",
};

export default function CreatePostPage() {
  return <CreateCampusPost />;
}
