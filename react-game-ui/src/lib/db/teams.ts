import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase-server";
import { DEFAULT_SEASON } from "@/config/constants";
import { logger } from "@/config/env";
import type { Team, TeamStanding, PlayerSeasonStats } from "@/types/nba";
import type { DbTeam, DbStanding, DbPlayerSeasonStats } from "@/types/db";

export interface FetchTeamRosterOptions {
  teamId: number;
  season?: string;
}

export interface FetchTeamDetailOptions {
  teamId: number;
  season?: string;
}

export interface TeamDetailResult {
  team: DbTeam;
  standing: DbStanding | null;
}

/**
 * 获取球队阵容（带赛季统计）
 */
async function _fetchTeamRosterInternal(
  options: FetchTeamRosterOptions
): Promise<DbPlayerSeasonStats[]> {
  const { teamId, season = DEFAULT_SEASON } = options;

  if (!teamId) {
    throw new Error("Team ID is required");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("player_season_stats")
    .select(
      `
      *,
      player:players!inner(
        id,
        full_name,
        headshot_url,
        position,
        team_id
      )
    `
    )
    .eq("team_id", teamId)
    .eq("season", season);

  if (error) {
    throw new Error(`Failed to fetch team roster: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  type RosterRow = {
    player_id: string | number;
    season: string;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    fantasy_avg: number;
    player: {
      id: string | number;
      full_name: string;
      headshot_url: string | null;
      position: string | null;
      team_id: string | number | null;
    } | null;
  };

  const rows = data as unknown as RosterRow[];

  const roster: DbPlayerSeasonStats[] = rows
    .map((stat) => {
      if (!stat.player) return null;

      const playerStats: PlayerSeasonStats = {
        player_id: String(stat.player_id),
        season: stat.season,
        pts: stat.pts,
        reb: stat.reb,
        ast: stat.ast,
        stl: stat.stl,
        blk: stat.blk,
        fantasy_avg: stat.fantasy_avg,
        player: {
          id: String(stat.player.id),
          full_name: stat.player.full_name,
          headshot_url: stat.player.headshot_url,
          team_id: stat.player.team_id ? String(stat.player.team_id) : null,
          position: stat.player.position || null,
        },
        team: null,
      };

      return playerStats;
    })
    .filter((item): item is DbPlayerSeasonStats => item !== null);

  return roster;
}

/**
 * 获取球队基础信息与战绩
 */
async function _fetchTeamDetailInternal(
  options: FetchTeamDetailOptions
): Promise<TeamDetailResult> {
  const { teamId, season = DEFAULT_SEASON } = options;

  if (!teamId) {
    throw new Error("Team ID is required");
  }

  const supabase = createServerClient();

  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError) {
    throw new Error(`Failed to fetch team info: ${teamError.message}`);
  }

  if (!teamData) {
    throw new Error("Team not found");
  }

  const { data: standingData, error: standingError } = await supabase
    .from("team_standings")
    .select("*")
    .eq("team_id", teamId)
    .eq("season", season)
    .single();

  if (standingError && standingError.code !== "PGRST116") {
    // PGRST116 means record not found, can be ignored
    logger.warn("[fetchTeamDetail] Standing fetch warning:", standingError);
  }

  const team: DbTeam = {
    id: String(teamData.id),
    name: teamData.name,
    nickname: teamData.nickname,
    code: teamData.code,
    city: teamData.city,
    logo_url: teamData.logo_url,
    conference: teamData.conference as Team["conference"],
    division: teamData.division,
    primary_color: teamData.primary_color,
    created_at: teamData.created_at,
  };

  let standing: DbStanding | null = null;

  if (standingData) {
    standing = {
      id: String(standingData.id),
      team_id: String(standingData.team_id),
      season: standingData.season,
      wins: standingData.wins,
      losses: standingData.losses,
      win_pct: standingData.win_pct,
      conf_rank: standingData.conf_rank,
      home_record: standingData.home_record ?? undefined,
      road_record: standingData.road_record ?? undefined,
      streak: standingData.streak ?? undefined,
      updated_at: standingData.updated_at ?? undefined,
      team,
    } satisfies TeamStanding;
  }

  return { team, standing };
}

/**
 * 带缓存的球队阵容查询
 */
export const fetchTeamRoster = unstable_cache(
  async (options: FetchTeamRosterOptions): Promise<DbPlayerSeasonStats[]> => {
    return _fetchTeamRosterInternal(options);
  },
  ["team-roster"],
  {
    tags: ["team-roster"],
    revalidate: 60,
  }
);

/**
 * 带缓存的球队详情查询
 */
export const fetchTeamDetail = unstable_cache(
  async (options: FetchTeamDetailOptions): Promise<TeamDetailResult> => {
    return _fetchTeamDetailInternal(options);
  },
  ["team-detail"],
  {
    tags: ["team-detail"],
    revalidate: 300,
  }
);
