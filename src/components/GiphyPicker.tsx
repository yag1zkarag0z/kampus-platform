"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CampusGif } from "@/data/campusPosts";

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyResult = {
  id?: string;
  title?: string;
  images?: { fixed_width?: GiphyImage; downsized?: GiphyImage; original?: GiphyImage };
};

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";

function toCampusGif(result: GiphyResult): CampusGif | null {
  const image = result.images?.fixed_width ?? result.images?.downsized ?? result.images?.original;
  const src = image?.webp ?? image?.url;
  const width = Number(image?.width);
  const height = Number(image?.height);
  if (!result.id || !src || !Number.isInteger(width) || !Number.isInteger(height)) return null;
  return { id: result.id, src, width, height, alt: (result.title?.trim() || "GIPHY GIF").slice(0, 160) };
}

export default function GiphyPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (gif: CampusGif) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CampusGif[]>([]);
  const [message, setMessage] = useState("GIF'ler yükleniyor…");
  const requestIdRef = useRef(0);
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  const load = useCallback(async (searchTerm = "") => {
    await Promise.resolve();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!apiKey) {
      setMessage("GIF araması için GIPHY anahtarı henüz ayarlanmadı.");
      return;
    }

    setMessage("GIF'ler yükleniyor…");
    try {
      const endpoint = searchTerm ? "search" : "trending";
      const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("limit", "18");
      url.searchParams.set("rating", "pg-13");
      url.searchParams.set("bundle", "messaging_non_clips");
      url.searchParams.set("country_code", "TR");
      url.searchParams.set("remove_low_contrast", "true");
      if (searchTerm) {
        url.searchParams.set("q", searchTerm.slice(0, 50));
        url.searchParams.set("lang", "tr");
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("GIPHY request failed");
      const payload = (await response.json()) as { data?: GiphyResult[] };
      const gifs = (payload.data ?? []).map(toCampusGif).filter((gif): gif is CampusGif => gif !== null);

      if (requestId !== requestIdRef.current) return;

      setResults(gifs);
      setMessage(gifs.length ? "" : "Bu aramada GIF bulunamadı.");
    } catch {
      if (requestId !== requestIdRef.current) return;

      setResults([]);
      setMessage("GIF'ler yüklenemedi. Biraz sonra tekrar dene.");
    }
  }, [apiKey]);

  useEffect(() => {
    const searchTerm = query.trim();
    requestIdRef.current += 1;
    const timer = window.setTimeout(
      () => void load(searchTerm),
      searchTerm ? 350 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [load, query]);

  return (
    <>
      <button
        type="button"
        aria-label="GIF seçiciyi kapat"
        onClick={onClose}
        className="fixed inset-0 z-[69] cursor-default bg-black/55 backdrop-blur-[2px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="GIPHY GIF seçici"
        className="fixed inset-x-3 bottom-3 z-[70] max-h-[calc(100svh-1.5rem)] min-w-0 overflow-hidden border border-white/12 bg-[#141720] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.65)] sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(44rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-4"
      >
      <div className="flex items-center gap-2">
        <div role="search" className="min-w-0 flex-1">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={50}
          placeholder="GIF ara"
          aria-label="GIPHY'de GIF ara"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          className={`min-h-10 min-w-0 flex-1 border border-white/12 bg-white/5 px-3 text-xs text-white placeholder:text-white/40 ${focusRing}`}
        />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="GIF seçiciyi kapat"
          className={`grid size-10 shrink-0 place-items-center border border-white/12 text-lg text-white/65 hover:bg-white/8 hover:text-white ${focusRing}`}
        >
          ×
        </button>
      </div>

      {message && <p role="status" className="py-8 text-center text-xs font-semibold text-white/55">{message}</p>}

      {results.length > 0 && (
        <>
          <p className="mt-3 text-[10px] font-bold text-white/45">
            {results.length} GIF · Daha fazlası için aşağı kaydır
          </p>
          <div className="mt-2 grid max-h-[min(56svh,24rem)] grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-4">
          {results.map((gif) => (
            <button
              key={gif.id}
              type="button"
              aria-label={`${gif.alt} GIF'ini seç`}
              onClick={() => onSelect(gif)}
              className={`relative aspect-square overflow-hidden bg-black/30 transition-opacity hover:opacity-80 ${focusRing}`}
            >
              <Image src={gif.src} alt="" fill sizes="112px" unoptimized className="object-cover" />
            </button>
          ))}
          </div>
        </>
      )}

      <a href="https://giphy.com/" target="_blank" rel="noreferrer" className={`mt-3 inline-flex text-[10px] font-black uppercase tracking-[0.12em] text-white/55 hover:text-white ${focusRing}`}>
        Powered by GIPHY
      </a>
      </section>
    </>
  );
}
