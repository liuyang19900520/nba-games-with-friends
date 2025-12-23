import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Profile - NBA Fantasy Manager",
  description: "View and manage your NBA fantasy profile.",
};

/**
 * Profile 页面 - 当前为静态占位
 *
 * 后续 Step 中会接入 Supabase Auth 服务端会话信息。
 */
export default async function ProfilePage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Profile" showSettings />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <div className="flex items-center justify-center h-full">
          <h1 className="text-2xl font-bold text-white">Profile Page</h1>
        </div>
      </div>
    </div>
  );
}
