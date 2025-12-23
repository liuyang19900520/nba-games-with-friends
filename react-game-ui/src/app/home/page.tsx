import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Home - NBA Fantasy Manager",
  description: "Overview of your NBA fantasy activity and navigation entry.",
};

/**
 * Home 页面 - 目前为静态概览页
 *
 * 后续可以在这里接入用户战绩摘要、最近比赛等 Dashboard 数据。
 */
export default async function HomePage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Home" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <div className="flex items-center justify-center h-full">
          <h1 className="text-2xl font-bold text-white">Home Page</h1>
        </div>
      </div>
    </div>
  );
}
