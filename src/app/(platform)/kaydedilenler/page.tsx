import type { Metadata } from "next";
import PlatformEmptyState from "@/components/PlatformEmptyState";

export const metadata: Metadata = {
  title: "Kaydedilenler | KAMPÜS.",
};

export default function BookmarksPage() {
  return (
    <PlatformEmptyState
      eyebrow="Kişisel alan"
      title="Kaydedilenler"
      description="Daha sonra dönmek istediğin gönderileri yalnızca senin görebileceğin bu alanda tutacağız."
    />
  );
}
