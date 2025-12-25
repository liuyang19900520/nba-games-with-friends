import type { Metadata, ResolvingMetadata } from "next";
import { Suspense } from "react";
import { TeamPageClient } from "@/components/features/team/TeamPageClient";
import { TeamPageSkeleton } from "@/components/features/team/TeamPageSkeleton";
import { fetchTeamDetail, fetchTeamRoster } from "@/lib/db/teams";
import type { TeamDetail } from "@/types";

interface TeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export async function generateMetadata(
  { params }: TeamPageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { teamId } = await params;
  const numericId = Number.parseInt(teamId, 10);

  if (Number.isNaN(numericId)) {
    return {
      title: "Team Detail | NBA Game",
      description: "View detailed roster and stats for an NBA team.",
    };
  }

  try {
    const { team } = await fetchTeamDetail({ teamId: numericId });

    if (!team) {
      return {
        title: "Team Not Found | NBA Game",
        description: "The team you are looking for could not be found.",
      };
    }

    const fullName = `${team.city} ${team.name}`;

    return {
      title: `${fullName} | NBA Game`,
      description: `View roster and stats for the ${team.name}.`,
    };
  } catch {
    return {
      title: "Team Detail | NBA Game",
      description: "View detailed roster and stats for an NBA team.",
    };
  }
}

/**
 * Team 详情页 - Server Component
 *
 * - 从动态路由 params 中解析 teamId
 * - 在服务端获取球队详情和阵容
 * - 使用 Suspense 包裹客户端组件，实现加载骨架屏
 */
export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId: teamIdParam } = await params;
  const teamId = Number.parseInt(teamIdParam, 10);

  if (Number.isNaN(teamId)) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-brand-text-dim">Invalid team id.</p>
      </div>
    );
  }

  const [{ team, standing }, roster] = await Promise.all([
    fetchTeamDetail({ teamId }),
    fetchTeamRoster({ teamId }),
  ]);

  if (!team) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-brand-text-dim">Team not found.</p>
      </div>
    );
  }

  const record =
    standing && standing.wins != null && standing.losses != null
      ? `${standing.wins}-${standing.losses}`
      : "0-0";

  const teamDetail: TeamDetail = {
    id: team.id,
    name: team.nickname || team.name,
    logo: team.logo_url || undefined,
    rank: standing?.conf_rank || 0,
    record,
    conference: team.conference,
    stats: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      stl: 0,
      blk: 0,
      tov: 0,
    },
    players: roster.map((stat) => ({
      id: String(stat.player_id),
      name: stat.player?.full_name ?? "Unknown",
      position:
        (stat.player?.position as "PG" | "SG" | "SF" | "PF" | "C") || "C",
      avatar: stat.player?.headshot_url || "",
      pts: Number(stat.pts) || 0,
      reb: Number(stat.reb) || 0,
      ast: Number(stat.ast) || 0,
      stl: Number(stat.stl) || 0,
      blk: Number(stat.blk) || 0,
      tov: 0,
      fantasyScore: Number(stat.fantasy_avg) || 0,
      fantasyScores: [],
    })),
  };

  return (
    <Suspense fallback={<TeamPageSkeleton />}>
      <TeamPageClient teamDetail={teamDetail} />
    </Suspense>
  );
}
