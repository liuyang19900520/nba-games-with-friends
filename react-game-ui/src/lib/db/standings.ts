import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase-server";
import {
  DEFAULT_SEASON,
  CONFERENCES,
  TEAM_SORT_OPTIONS,
  SORT_DIRECTIONS,
  type Conference,
  type TeamSortOption,
  type SortDirection,
} from "@/config/constants";
import type { TeamStanding, DatabaseTeamStanding } from "@/types/nba";
import type { DbStanding } from "@/types/db";

export interface FetchStandingsOptions {
  season?: string;
  conference?: Conference;
  orderBy?: TeamSortOption;
  orderDirection?: SortDirection;
}

/**
 * 将 Supabase 返回的原始行转换为 DbStanding（TeamStanding）
 */
function mapStandingRow(row: DatabaseTeamStanding): DbStanding | null {
  if (!row.team) return null;

  return {
    id: String(row.id),
    team_id: String(row.team_id),
    season: row.season,
    wins: row.wins,
    losses: row.losses,
    win_pct: row.win_pct,
    conf_rank: row.conf_rank,
    home_record: row.home_record ?? undefined,
    road_record: row.road_record ?? undefined,
    streak: row.streak ?? undefined,
    updated_at: row.updated_at ?? undefined,
    team: {
      ...row.team,
      id: String(row.team.id),
    },
  } satisfies TeamStanding;
}

async function _fetchStandingsInternal(
  options: FetchStandingsOptions = {}
): Promise<DbStanding[]> {
  const {
    season = DEFAULT_SEASON,
    conference,
    orderBy = TEAM_SORT_OPTIONS.CONF_RANK,
    orderDirection = SORT_DIRECTIONS.ASC,
  } = options;

  const supabase = createServerClient();

  let query = supabase
    .from("team_standings")
    .select(
      `
      id,
      team_id,
      season,
      wins,
      losses,
      win_pct,
      conf_rank,
      home_record,
      road_record,
      streak,
      updated_at,
      team:teams!inner (
        id,
        name,
        nickname,
        code,
        city,
        logo_url,
        conference,
        division,
        primary_color
      )
    `
    )
    .eq("season", season)
    .order(orderBy, { ascending: orderDirection === SORT_DIRECTIONS.ASC });

  if (conference && conference !== CONFERENCES.ALL) {
    // 注意：联表字段需要使用 join 表别名
    query = query.eq("teams.conference", conference);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch standings: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const rows = data as unknown as DatabaseTeamStanding[];
  return rows
    .map(mapStandingRow)
    .filter((row): row is DbStanding => row !== null);
}

/**
 * 带缓存的球队战绩查询
 *
 * - 使用 unstable_cache + tags 支持后续 revalidateTag('standings')
 * - 默认每 60 秒重新验证一次
 */
export const fetchStandings = unstable_cache(
  async (options: FetchStandingsOptions = {}): Promise<DbStanding[]> => {
    return _fetchStandingsInternal(options);
  },
  ["standings"],
  {
    tags: ["standings"],
    revalidate: 60,
  }
);
