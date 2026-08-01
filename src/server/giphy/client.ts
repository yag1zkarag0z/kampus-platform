import "server-only";

import type { ContentGifDto } from "@/content/types";
import { AuthError } from "@/server/auth/errors";

const allowedHosts = /^(?:media\d*\.)?giphy\.com$/iu;

type GiphyImage = {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
};

type GiphyGif = {
  id?: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImage;
    downsized?: GiphyImage;
    original?: GiphyImage;
  };
};

function configurationError() {
  return new AuthError(
    "AUTH_CONFIGURATION_ERROR",
    "GIF servisi şu anda kullanılamıyor.",
    { status: 503 },
  );
}

function normalizeGif(data: GiphyGif): ContentGifDto {
  const image = data.images?.fixed_width ?? data.images?.downsized ?? data.images?.original;
  const rawUrl = image?.webp ?? image?.url;
  const width = Number(image?.width);
  const height = Number(image?.height);

  if (!data.id || !rawUrl || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw configurationError();
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !allowedHosts.test(url.hostname)) {
    throw configurationError();
  }

  return {
    id: data.id,
    src: url.toString(),
    width,
    height,
    alt: (data.title?.trim() || "GIPHY GIF").slice(0, 160),
  };
}

export async function resolveGiphyGif(gifId: string): Promise<ContentGifDto> {
  const apiKey = process.env.GIPHY_API_KEY ?? process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey) throw configurationError();

  const url = new URL(`https://api.giphy.com/v1/gifs/${encodeURIComponent(gifId)}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("country_code", "TR");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new AuthError("INVALID_REQUEST", "Seçtiğin GIF doğrulanamadı.", {
      fieldErrors: { gifId: ["Başka bir GIF seçip yeniden dene."] },
      status: 400,
    });
  }

  const payload = (await response.json()) as { data?: GiphyGif };
  return normalizeGif(payload.data ?? {});
}
