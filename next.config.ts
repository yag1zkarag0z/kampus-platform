import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_E2E === "true" ? ".next-e2e" : ".next",
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
