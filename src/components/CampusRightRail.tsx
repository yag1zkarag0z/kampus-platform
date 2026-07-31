"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useCampusData } from "@/components/CampusDataProvider";
import {
  getCampusPostCommentCount,
  type CampusPostCategory,
} from "@/data/campusPosts";

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
          (total, post) => total + getCampusPostCommentCount(post),
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
          className="flex min-h-12 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/58 outline-none transition-colors hover:border-[#ff7a45]/35 hover:bg-white/8 focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40"
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
          className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/4"
        >
          <div className="border-b border-white/8 px-5 py-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
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
                className="border-b border-white/8 last:border-0"
              >
                <Link
                  href="/kesfet"
                  aria-label={`${topic.name} konusunu keşfet`}
                  className="group block px-5 py-4 outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-5 tracking-[-0.02em] group-hover:text-[#ff7a45]">
                        {topic.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-white/60">
                        {topic.description}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
                        {topic.activity}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[#ff7a45]/25 bg-[#ff7a45]/10 font-mono text-[9px] font-bold text-[#ff7a45]"
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
            className="block border-t border-white/8 px-5 py-3.5 text-xs font-bold text-[#ff7a45] outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/5"
          >
            Tüm başlıkları gör
          </Link>
        </section>

        <section
          aria-labelledby="campus-calendar-title"
          className="mt-4 rounded-[1.35rem] border border-white/10 bg-[#24242b] p-5"
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#aaa6ba]">
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
                <div className="grid size-11 shrink-0 place-items-center border border-white/12 bg-white/6 text-center">
                  <span className="block text-sm font-black leading-none">
                    {event.day}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] font-bold tracking-[0.1em] text-[#ff7a45]">
                    {event.month}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold leading-5">{event.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/58">
                    {event.place}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-5 border-l-2 border-[#ff7a45] pl-3 text-[11px] leading-5 text-white/62">
          KAMPÜS bağımsız bir öğrenci projesidir. Yaşar Üniversitesi’nin resmî
          platformu değildir.
        </p>
      </div>
    </aside>
  );
}
