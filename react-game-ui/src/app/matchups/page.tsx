import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Matchups - NBA Fantasy Manager",
  description: "View upcoming and current fantasy matchups.",
};

/**
 * Matchups 页面 - 目前为静态占位
 *
 * 后续可以在这里接入对战日程、对阵详情等数据。
 */
export default async function MatchupsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Matchups" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <div className="flex items-center justify-center h-full">
          <h1 className="text-2xl font-bold text-white">Matchups Page</h1>
        </div>
      </div>
    </div>
  );
}
