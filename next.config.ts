import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

function configuredWebSocketSource() {
  try {
    const appOrigin = new URL(process.env.APP_ORIGIN ?? "");
    const protocol = appOrigin.protocol === "https:" ? "wss:" : "ws:";

    return `${protocol}//${appOrigin.host}`;
  } catch {
    return null;
  }
}

const websocketSource = configuredWebSocketSource();
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.giphy.com",
  "font-src 'self' data:",
  `connect-src 'self' blob: data: https://api.giphy.com${websocketSource ? ` ${websocketSource}` : ""}${isDevelopment ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  ...(isDevelopment
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
