"use client";

import Link from "next/link";
import { useId, useMemo } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import { useCampusPostQuery } from "@/components/useCampusPostQuery";
import {
  getCampusTrendingMetrics,
  rankCampusTrendingPosts,
} from "@/content/trending";

export default function CampusTrendingTopics({
  variant = "rail",
}: {
  variant?: "rail" | "mobile";
}) {
  const { posts } = useCampusData();
  const { isGuest } = useCampusAccount();
  const isMobile = variant === "mobile";
  const topicLimit = isMobile ? 3 : 4;
  const { posts: memberTrendingPosts, isLoading } = useCampusPostQuery({
    sort: "trending",
    limit: topicLimit,
    enabled: !isGuest,
  });
  const titleId = useId();
  const trendingPosts = useMemo(
    () => {
      if (isGuest) {
        return rankCampusTrendingPosts(posts, { limit: topicLimit });
      }

      // Sunucu cursor'daki sabit İstanbul tarihine göre sıraladı; burada
      // yeniden sıralamak gece yarısında sonucu oynatabilir. Sırayı koru,
      // yalnızca ekranda gösterilecek etkileşim toplamını hesapla.
      return memberTrendingPosts.map((post) => ({
        post,
        ...getCampusTrendingMetrics(post),
        dayRank: 0,
      }));
    },
    [isGuest, memberTrendingPosts, posts, topicLimit],
  );

  return (
    <section
      aria-labelledby={titleId}
      className={
        isMobile
          ? "overflow-hidden border-y border-white/9 bg-canvas"
          : "overflow-hidden rounded-2xl border border-white/9 bg-surface"
      }
    >
      <header
        className={`border-b border-white/8 ${isMobile ? "px-5 py-4" : "px-4 py-3.5"}`}
      >
        <h2
          id={titleId}
          className={`${isMobile ? "text-2xl" : "text-xl"} font-black tracking-[-0.04em]`}
        >
          Kampüste ne oluyor?
        </h2>
      </header>

      {!isGuest && isLoading ? (
        <div className="space-y-px" aria-label="Kampüs gündemi yükleniyor">
          {Array.from({ length: topicLimit }, (_, item) => item).map((item) => (
            <div
              key={item}
              className={`${isMobile ? "h-[88px]" : "h-[75px]"} animate-pulse border-b border-white/7 bg-white/[0.018] last:border-0`}
            />
          ))}
        </div>
      ) : trendingPosts.length > 0 ? (
        <ol>
          {trendingPosts.map(({ post, interactions }, index) => (
            <li key={post.id} className="border-b border-white/7 last:border-0">
              <Link
                href={`/gonderi/${post.id}`}
                className={`group grid grid-cols-[1fr_auto] gap-3 outline-none transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35 ${isMobile ? "px-5 py-3.5" : "px-4 py-3"}`}
              >
                <span className="min-w-0">
                  {isMobile && (
                    <span className="block text-sm font-medium text-white/42">
                      {post.category} · Kampüste gündem
                    </span>
                  )}
                  <span
                    className={`block truncate font-bold tracking-[-0.02em] text-white/90 group-hover:text-white ${isMobile ? "mt-0.5 text-xl leading-7" : "text-base leading-6"}`}
                  >
                    {post.title}
                  </span>
                  <span
                    className={`${isMobile ? "mt-1" : "mt-0.5"} block text-xs font-medium text-white/42`}
                  >
                    {isMobile
                      ? `${interactions} etkileşim`
                      : `${post.category} · ${interactions} etkileşim`}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`${isMobile ? "text-xl tracking-[0.12em]" : "font-mono text-xs font-bold"} text-white/32`}
                >
                  {isMobile ? "•••" : `0${index + 1}`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm leading-6 text-white/48">
          Gündem oluştuğunda burada görünecek.
        </p>
      )}

      {!isMobile && (
        <Link
          href="/kesfet"
          className="block border-t border-white/8 px-4 py-3 text-xs font-bold text-brand outline-none transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35"
        >
          Daha fazlasını keşfet
        </Link>
      )}
    </section>
  );
}
