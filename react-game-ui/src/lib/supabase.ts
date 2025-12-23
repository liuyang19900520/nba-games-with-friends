"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 客户端 Supabase 客户端
 *
 * 用于 Client Components 中的 Supabase 操作（如实时订阅、客户端认证等）。
 * 使用 process.env.NEXT_PUBLIC_ 前缀的环境变量。
 *
 * 注意：
 * - 仅在客户端组件中使用
 * - 需要 persistSession 和 autoRefreshToken（浏览器环境）
 * - 使用延迟初始化，避免在服务端执行时抛出错误
 */

let supabaseInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端单例（延迟初始化）
 * 确保整个应用只创建一个客户端实例
 *
 * 只在客户端运行时初始化，避免服务端渲染时出错
 */
function getSupabaseClient(): SupabaseClient {
  // 如果已经初始化，直接返回
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // 检查是否在客户端环境
  if (typeof window === "undefined") {
    throw new Error(
      "Supabase client can only be used in client components. " +
        "For server-side operations, use createServerClient from @/lib/db/supabase-server"
    );
  }

  // 在客户端环境初始化
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg =
      "Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.";
    console.error("[supabase] Configuration error:", errorMsg);
    throw new Error(errorMsg);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true, // 客户端需要持久化会话
      autoRefreshToken: true, // 客户端需要自动刷新 token
    },
  });

  return supabaseInstance;
}

/**
 * 导出 Supabase 客户端
 * 使用 getter 函数实现延迟初始化
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getSupabaseClient();
    const key = prop as keyof SupabaseClient;
    const value = client[key];
    // 如果是函数，绑定 this 上下文
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
