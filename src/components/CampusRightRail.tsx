"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useCampusData } from "@/components/CampusDataProvider";
import type { CampusPostCategory } from "@/data/campusPosts";

const topicDefinitions: {
  name: string;
  description: string;
  category: CampusPostCategory;
}[] = [
  {
    name: "Sorular",
    description: "Dersler, sınavlar ve çalışma önerileri",
    category: "Soru",
  },
  {
    name: "İtiraflar",
    description: "Kampüsten anonim hikâyeler ve düşünceler",
    category: "İtiraf",
  },
  {
    name: "Kayıp & Buluntu",
    description: "Kaybolan eşyaları birlikte bulalım",
    category: "Kayıp Eşya",
  },
];

const events = [
  {
    day: "28",
    month: "TEM",
    title: "Kulüpler Tanışma Günü",
    place: "Selçuk Yaşar Kampüsü",
  },
  {
    day: "31",
    month: "TEM",
    title: "Açık Hava Film Gösterimi",
    place: "Kampüs bahçesi",
  },
];

export default function CampusRightRail() {
  const { posts } = useCampusData();
  const topicHubs = useMemo(
    () =>
      topicDefinitions.map((topic) => {
        const topicPosts = posts.filter(
          (post) => post.category === topic.category
        );
        const likes = topicPosts.reduce(
          (total, post) => total + post.likes,
          0
        );
        const comments = topicPosts.reduce(
          (total, post) => total + post.comments.length,
          0
        );

        return {
          ...topic,
          activity: `${topicPosts.length} gönderi · ${likes} beğeni · ${comments} yorum`,
        };
      }),
    [posts]
  );

  return (
    <aside className="hidden min-w-0 min-[1280px]:block">
      <div className="sticky top-0 h-svh overflow-y-auto px-5 py-5 xl:px-6">
        <Link
          href="/kesfet#kampus-search"
          className="flex min-h-12 items-center gap-3 rounded-full border border-[#1c2821]/12 bg-[#f8f4ed]/78 px-4 text-sm text-[#1c2821]/58 outline-none transition-colors hover:border-[#5a1f32]/28 hover:bg-[#fffaf4] focus-visible:ring-3 focus-visible:ring-[#5a1f32]/20 dark:border-white/10 dark:bg-white/5 dark:text-[#ece8e1]/58 dark:hover:border-[#c7896d]/35 dark:hover:bg-white/8"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="size-4.5"
          >
            <circle
              cx="10.8"
              cy="10.8"
              r="6.3"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="m15.6 15.6 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          Kampüste ara
        </Link>

        <section
          aria-labelledby="topic-hubs-title"
          className="mt-5 overflow-hidden rounded-[1.35rem] border border-[#1c2821]/12 bg-[#f8f4ed]/72 dark:border-white/10 dark:bg-white/4"
        >
          <div className="border-b border-[#1c2821]/10 px-5 py-4 dark:border-white/8">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
              Konulara göre keşfet
            </p>
            <h2
              id="topic-hubs-title"
              className="mt-1 text-lg font-black tracking-[-0.035em]"
            >
              Kampüs başlıkları
            </h2>
          </div>

          <ul>
            {topicHubs.map((topic, index) => (
              <li
                key={topic.name}
                className="border-b border-[#1c2821]/9 last:border-0 dark:border-white/8"
              >
                <Link
                  href="/kesfet"
                  aria-label={`${topic.name} konusunu keşfet`}
                  className="group block px-5 py-4 outline-none transition-colors hover:bg-white/55 focus-visible:bg-white/55 dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-5 tracking-[-0.02em] group-hover:text-[#7d3c2d] dark:group-hover:text-[#d09272]">
                        {topic.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[#1c2821]/64 dark:text-white/60">
                        {topic.description}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#1c2821]/52 dark:text-white/50">
                        {topic.activity}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[#9a5944]/24 bg-[#9a5944]/8 font-mono text-[9px] font-bold text-[#7d3c2d] dark:border-[#c7896d]/25 dark:bg-[#c7896d]/10 dark:text-[#d09272]"
                    >
                      0{index + 1}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/kesfet"
            className="block border-t border-[#1c2821]/9 px-5 py-3.5 text-xs font-bold text-[#7d3c2d] outline-none transition-colors hover:bg-white/55 focus-visible:bg-white/55 dark:border-white/8 dark:text-[#d09272] dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
          >
            Tüm başlıkları gör
          </Link>
        </section>

        <section
          aria-labelledby="campus-calendar-title"
          className="mt-4 rounded-[1.35rem] border border-[#1c2821]/12 bg-[#dedde4]/66 p-5 dark:border-white/10 dark:bg-[#24242b]"
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b477a] dark:text-[#aaa6ba]">
            Yaklaşan
          </p>
          <h2
            id="campus-calendar-title"
            className="mt-1 text-lg font-black tracking-[-0.035em]"
          >
            Kampüs takvimi
          </h2>

          <ol className="mt-4 space-y-4">
            {events.map((event) => (
              <li key={event.title} className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center border border-[#1c2821]/15 bg-white/42 text-center dark:border-white/12 dark:bg-white/6">
                  <span className="block text-sm font-black leading-none">
                    {event.day}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-[#7d3c2d] dark:text-[#d09272]">
                    {event.month}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold leading-5">{event.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#1c2821]/62 dark:text-white/58">
                    {event.place}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-5 border-l-2 border-[#9a5944] pl-3 text-[11px] leading-5 text-[#1c2821]/64 dark:border-[#c7896d] dark:text-white/62">
          KAMPÜS bağımsız bir öğrenci projesidir. Yaşar Üniversitesi’nin resmî
          platformu değildir.
        </p>
      </div>
    </aside>
  );
}
