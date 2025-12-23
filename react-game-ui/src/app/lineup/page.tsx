import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { LineupPageClient } from '@/components/features/lineup/LineupPageClient';
import { LineupPageSkeleton } from '@/components/features/lineup/LineupPageSkeleton';
import { LineupErrorDisplay } from '@/components/features/lineup/LineupErrorDisplay';
import { fetchPlayers } from '@/lib/db/players';

/**
 * Lineup 页面 - Server Component (RSC)
 *
 * 纯服务端组件，负责：
 * - 静态布局（Header, 背景容器）
 * - 服务端数据获取
 * - 错误边界处理
 * - Suspense 流式渲染
 *
 * 所有交互逻辑都在 LineupPageClient 中处理。
 */
export default async function LineupPage() {
  try {
    // ✅ 服务端数据获取（在 RSC 中）
    const players = await fetchPlayers();

    return (
      <div className="flex flex-col h-full">
        {/* 静态 Header - 在 RSC 中渲染 */}
        <Header title="My Lineup Selection" showBack showSettings />

        {/* 内容区域 - 使用 Suspense 包裹客户端组件 */}
        <div className="flex-1 overflow-y-auto pt-[60px]">
          <Suspense fallback={<LineupPageSkeleton />}>
            <LineupPageClient players={players} />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    // 错误边界 - 在 RSC 中处理
    return (
      <div className="flex flex-col h-full">
        <Header title="My Lineup Selection" showBack showSettings />
        <div className="flex-1 overflow-y-auto pt-[60px]">
          <LineupErrorDisplay error={error} />
        </div>
      </div>
    );
  }
}
