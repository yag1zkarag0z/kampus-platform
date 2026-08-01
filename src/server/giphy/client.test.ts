import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveGiphyGif } from "./client";

describe("resolveGiphyGif", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("validates a selected GIF with the PG-13 filter", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "happy123",
            title: "Happy reaction",
            images: {
              fixed_width: {
                webp: "https://media2.giphy.com/media/happy123/200w.webp",
                width: "200",
                height: "120",
              },
            },
          },
        }),
      ),
    );

    await expect(resolveGiphyGif("happy123")).resolves.toEqual({
      id: "happy123",
      src: "https://media2.giphy.com/media/happy123/200w.webp",
      width: 200,
      height: 120,
      alt: "Happy reaction",
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("rating")).toBe("pg-13");
    expect(requestedUrl.searchParams.get("country_code")).toBe("TR");
  });

  it("rejects a media URL outside GIPHY", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "unsafe",
            images: {
              fixed_width: {
                webp: "https://example.com/tracker.webp",
                width: "200",
                height: "120",
              },
            },
          },
        }),
      ),
    );

    await expect(resolveGiphyGif("unsafe")).rejects.toMatchObject({
      code: "AUTH_CONFIGURATION_ERROR",
      status: 503,
    });
  });
});
