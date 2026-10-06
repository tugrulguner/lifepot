import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  // Browser hit-tests should measure the game, not Next's development-only badge.
  devIndicators: process.env.LIFEPOT_E2E === "1" ? false : undefined,
};

export default nextConfig;
