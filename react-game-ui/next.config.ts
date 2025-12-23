import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 注意: PPR 在 Next.js 15 稳定版中需要在路由级别配置
  // 使用 export const experimental_ppr = true 在页面文件中

  // 转译 Supabase 包以解决 Next.js 15 兼容性问题
  transpilePackages: ["@supabase/supabase-js"],

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
