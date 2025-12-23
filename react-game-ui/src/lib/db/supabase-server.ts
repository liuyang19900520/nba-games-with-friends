import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 服务端 Supabase 客户端
 *
 * 用于 Server Components 和 Server Actions。
 * 使用 process.env 获取环境变量（Next.js 服务端环境）。
 *
 * 注意：
 * - 服务端客户端不需要 persistSession（无浏览器环境）
 * - 使用服务端专用环境变量，避免暴露到客户端
 */

/**
 * 推荐的环境变量命名约定：
 * - SUPABASE_URL:            Supabase 项目 URL（服务端专用）
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role 密钥，仅在服务端使用，绝不能暴露到客户端
 *
 * 客户端 Supabase 初始化应继续使用：
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 检查 Supabase 环境变量是否配置
 */
export function hasSupabaseConfig(): boolean {
  return !!(supabaseUrl && supabaseServiceRoleKey);
}

/**
 * 创建服务端 Supabase 客户端
 *
 * 每次调用都会创建新实例，适合在 Server Components 中使用。
 * 如果需要单例模式，可以考虑使用缓存。
 *
 * @returns SupabaseClient 实例
 * @throws Error 如果环境变量未配置
 */
export function createServerClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const errorMsg =
      "Missing Supabase server environment variables. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local / Vercel project settings.";
    console.error("[supabase-server] Configuration error:", errorMsg);
    throw new Error(errorMsg);
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false, // 服务端不需要持久化会话
      autoRefreshToken: false, // 服务端不需要自动刷新 token
    },
  });
}
