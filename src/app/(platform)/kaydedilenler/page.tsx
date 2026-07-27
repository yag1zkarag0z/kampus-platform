import type { Metadata } from "next";
import CampusSavedPosts from "@/components/CampusSavedPosts";

export const metadata: Metadata = {
  title: "Kaydedilenler | KAMPÜS.",
  description:
    "Daha sonra dönmek için kaydettiğin kampüs konularını tek yerde görüntüle.",
};

export default function BookmarksPage() {
  return <CampusSavedPosts />;
}
