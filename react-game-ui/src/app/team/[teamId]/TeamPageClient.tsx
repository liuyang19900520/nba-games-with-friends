'use client';

import { Header } from "@/components/layout/Header";
import { TeamDetailView } from "@/components/team/TeamDetailView";
import type { TeamDetail } from "@/types";

interface TeamPageClientProps {
  teamDetail: TeamDetail;
}

/**
 * Team 详情页客户端组件（完全由 RSC 提供数据）
 */
export function TeamPageClient({ teamDetail }: TeamPageClientProps) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Team Roster & Stats" showBack showSearch />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
        <TeamDetailView team={teamDetail} />
      </div>
    </div>
  );
}

