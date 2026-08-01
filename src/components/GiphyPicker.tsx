"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";

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

export default function GiphyPicker({ onSelect }: { onSelect: (gif: CampusGif) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CampusGif[]>([]);
  const [message, setMessage] = useState("GIF'ler yükleniyor…");
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  const load = useCallback(async (searchTerm = "") => {
    await Promise.resolve();

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
      setResults(gifs);
      setMessage(gifs.length ? "" : "Bu aramada GIF bulunamadı.");
    } catch {
      setResults([]);
      setMessage("GIF'ler yüklenemedi. Biraz sonra tekrar dene.");
    }
  }, [apiKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(query.trim());
  };

  return (
    <div className="absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[min(90vw,22rem)] border border-white/12 bg-[#141720] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={50}
          placeholder="GIF ara"
          aria-label="GIPHY'de GIF ara"
          className={`min-h-10 min-w-0 flex-1 border border-white/12 bg-white/5 px-3 text-xs text-white placeholder:text-white/40 ${focusRing}`}
        />
        <button type="submit" className={`min-h-10 bg-white px-3 text-xs font-black text-[#12100e] ${focusRing}`}>Ara</button>
      </form>

      {message && <p role="status" className="py-8 text-center text-xs font-semibold text-white/55">{message}</p>}

      {results.length > 0 && (
        <div className="mt-3 grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
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
      )}

      <a href="https://giphy.com/" target="_blank" rel="noreferrer" className={`mt-3 inline-flex text-[10px] font-black uppercase tracking-[0.12em] text-white/55 hover:text-white ${focusRing}`}>
        Powered by GIPHY
      </a>
    </div>
  );
}
