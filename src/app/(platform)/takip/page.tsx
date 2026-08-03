import type { Metadata } from "next";

import { FollowSuggestionsPage } from "@/components/FollowSuggestions";

export const metadata: Metadata = {
  title: "Takip Önerileri | KAMPÜS.",
  description:
    "Kampüsteki diğer öğrencileri keşfet ve takip etmeye başla.",
};

export default function FollowSuggestionsRoutePage() {
  return <FollowSuggestionsPage />;
}
