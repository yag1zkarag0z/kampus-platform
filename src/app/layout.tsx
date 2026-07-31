import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin-ext"],
});

const themeScript = `(function(){try{var root=document.documentElement;if(window.location.pathname==="/"){root.setAttribute("data-theme","dark");root.style.colorScheme="dark";return}var saved=localStorage.getItem("kampus-theme");var theme=saved==="dark"||saved==="light"?saved:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";root.setAttribute("data-theme",theme);root.style.colorScheme=theme}catch(e){}})()`;

export const metadata: Metadata = {
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
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
