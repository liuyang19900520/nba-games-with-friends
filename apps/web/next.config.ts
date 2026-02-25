import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Note: PPR (Partial Prerendering) in Next.js 15 stable requires configuration at the route level
  // Use export const experimental_ppr = true in page files

  // Transpile Supabase packages to resolve Next.js 15 compatibility issues
  transpilePackages: ["@supabase/supabase-js", "@supabase/ssr"],

  serverExternalPackages: [],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn.nba.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "./src"),
    };
    return config;
  },
};

export default nextConfig;
