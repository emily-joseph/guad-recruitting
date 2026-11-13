import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the auth browser fixture separate from an existing local dev server.
  distDir: process.env.AUTH_BROWSER_TESTS === "true" ? ".next/auth-tests" : ".next",
};

export default nextConfig;
