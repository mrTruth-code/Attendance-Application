import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance and stability
  reactStrictMode: true,
  // Ensure Turbopack behaves in this specific environment
  experimental: {
    // Some versions of Next 15+ use this for Turbopack root
    // @ts-ignore
    turbopack: {
      useMicrotaskTaskQueue: true
    }
  }
};

export default nextConfig;
