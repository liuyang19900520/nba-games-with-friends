import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 创建服务端 Supabase 客户端（用于 Server Components 和 Server Actions）
 *
 * 使用 @supabase/ssr 的 createServerClient，自动处理 cookie 的读取和写入。
 * 适用于 Next.js 15 App Router 的认证流程。
 *
 * 注意：Next.js 15 中 cookies() 返回 Promise，需要 await
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // 在 Server Actions 中，cookies().set() 可能失败（例如在中间件中）
            // 这种情况下，cookie 会在客户端自动设置
          }
        },
      },
    }
  );
}
