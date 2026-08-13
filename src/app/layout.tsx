import type { Metadata } from "next";

import { resolveApplicationOrigin } from "@/server/platform-environment";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(resolveApplicationOrigin(process.env)),
  title: "KAMPÜS. | Yaşar Öğrencileri İçin Sosyal Ağ",
  description:
    "Yaşar Üniversitesi öğrencileri için itirafların, soruların, duyuruların ve kampüs gündeminin bir araya geldiği bağımsız öğrenci platformu. Yaşar Üniversitesi’nin resmî platformu değildir.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
