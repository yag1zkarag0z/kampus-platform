import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_E2E === "true" ? ".next-e2e" : ".next",
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Proxy buffers at most 9 MiB. Route handlers apply lower, field-specific
    // limits while reading the stream and return a deterministic 413 response.
    proxyClientMaxBodySize: 9 * 1024 * 1024,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.giphy.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media0.giphy.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media1.giphy.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media2.giphy.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media3.giphy.com", pathname: "/media/**" },
      { protocol: "https", hostname: "media4.giphy.com", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
