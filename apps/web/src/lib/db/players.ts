import { unstable_cache } from "next/cache";
import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { DEFAULT_SEASON } from "@/config/constants";
import { logger } from "@/config/env";
import { getGameDate } from "@/lib/utils/game-date";
import type { Player } from "@/types";
import type { DatabasePlayerSeasonStats, Team } from "@/types/nba";
import type { DbPlayerSeasonStats, DbPlayer } from "@/types/db";

/**
 * 自定义错误类，包含详细的诊断信息
 */
export class PlayerFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PlayerFetchError";
  }
}

/**
 * 获取可用球员列表（服务端）
 *
 * 使用服务端 Supabase 客户端获取数据。
 * 如果失败，抛出详细的错误信息以便诊断。
 *
 * @param season - 赛季，默认为 DEFAULT_SEASON
 * @returns Promise<Player[]> 球员列表
 * @throws {PlayerFetchError} 当数据获取失败时
 */
export async function fetchPlayers(
  season: string = DEFAULT_SEASON
): Promise<Player[]> {
  // 检查环境变量配置
  if (!hasSupabaseConfig()) {
    const error = new PlayerFetchError(
      "Supabase 环境变量未配置",
      "MISSING_ENV_VARS",
      {
        required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        current: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        help: "请在 .env.local 文件中设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY",
      }
    );
    console.error("[fetchPlayers] 环境变量检查失败:", error);
    throw error;
  }

  try {
    const supabase = createServerClient();

    // 查询球员赛季统计数据
    const { data, error } = await supabase
      .from("player_season_stats")
      .select(
        `
        *,
        player:players!inner(
          id,
          full_name,
          position,
          headshot_url,
          team_id,
          team:teams(
            name,
            code
          )
        )
      `
      )
      .eq("season", season)
      .order("fantasy_avg", { ascending: false })
      .limit(20); // 限制返回数量，可以根据需要调整

    if (error) {
      const fetchError = new PlayerFetchError(
        `Supabase 查询失败: ${error.message}`,
        error.code || "SUPABASE_QUERY_ERROR",
        {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          query: "player_season_stats with players and teams join",
          season,
        }
      );
      console.error("[fetchPlayers] Supabase 查询错误:", {
        error: fetchError,
        supabaseError: error,
      });
      throw fetchError;
    }

    if (!data || data.length === 0) {
      logger.warn(
        `[fetchPlayers] Query succeeded but returned no data. Season: ${season}, Table: player_season_stats`
      );
      return [];
    }

    type Row = DatabasePlayerSeasonStats & {
      player: (DbPlayer & { team?: Team | null }) | null;
    };

    const rows = data as unknown as Row[];

    // 转换为 Player 类型（前端视图模型）
    const players: Player[] = rows
      .map((stat): Player | null => {
        if (!stat.player) {
          return null;
        }

        const team = stat.player.team;
        const teamName = team ? team.name : "Unknown Team";

        const playerData: Player = {
          id: String(stat.player.id),
          name: stat.player.full_name,
          team: teamName,
          position:
            (stat.player.position as "PG" | "SG" | "SF" | "PF" | "C") || "C",
          avatar: stat.player.headshot_url || "",
          ppg: stat.pts || 0,
          rpg: stat.reb || 0,
          apg: stat.ast || 0,
          fantasyScore: stat.fantasy_avg || 0,
        };

        return playerData;
      })
      .filter((player): player is Player => player !== null);

    return players;
  } catch (error) {
    // 如果是我们自定义的错误，直接抛出
    if (error instanceof PlayerFetchError) {
      throw error;
    }

    // 其他未知错误，包装为 PlayerFetchError
    const unknownError = new PlayerFetchError(
      `获取球员数据时发生未知错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "UNKNOWN_ERROR",
      {
        originalError: error instanceof Error ? error.stack : String(error),
        season,
      }
    );
    console.error("[fetchPlayers] 未知错误:", unknownError);
    throw unknownError;
  }
}

/**
 * 获取排行榜用的球员赛季统计（带 player/team 关联）
 * 默认按 fantasy_avg 排序，可切换为 PTS/REB/AST/STL/BLK。
 */
export async function fetchPlayerLeaderboardStats(
  season: string = DEFAULT_SEASON,
  limit: number = 50
): Promise<DbPlayerSeasonStats[]> {
  if (!hasSupabaseConfig()) {
    throw new PlayerFetchError("Supabase 环境变量未配置", "MISSING_ENV_VARS");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("player_season_stats")
    .select(
      `
      *,
      player:players!inner(
        *,
        team:teams(*)
      )
    `
    )
    .eq("season", season)
    .order("fantasy_avg", { ascending: false })
    .limit(limit);

  if (error) {
    throw new PlayerFetchError(
      `Failed to fetch player leaderboard stats: ${error.message}`,
      error.code,
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        season,
      }
    );
  }

  if (!data || data.length === 0) {
    return [];
  }

  const rows = data as unknown as (DatabasePlayerSeasonStats & {
    player?: (DbPlayer & { team?: Team | null }) | null;
  })[];

  const stats: DbPlayerSeasonStats[] = rows.map((row) => ({
    player_id: row.player_id,
    season: row.season,
    pts: row.pts,
    reb: row.reb,
    ast: row.ast,
    stl: row.stl,
    blk: row.blk,
    fantasy_avg: row.fantasy_avg,
    player: row.player ?? null,
    team: row.player?.team ?? null,
  }));

  return stats;
}

/**
 * 获取单个球员基础 Profile（players 表）
 */
export async function fetchPlayerProfile(
  playerId: string | number
): Promise<DbPlayer | null> {
  if (!playerId) {
    throw new PlayerFetchError("Player ID is required", "INVALID_PLAYER_ID");
  }

  if (!hasSupabaseConfig()) {
    throw new PlayerFetchError("Supabase 环境变量未配置", "MISSING_ENV_VARS");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("players")
    .select(
      `
      id,
      full_name,
      position,
      headshot_url,
      team_id
    `
    )
    .eq("id", playerId)
    .single();

  if (error) {
    throw new PlayerFetchError(
      `Failed to fetch player profile: ${error.message}`,
      error.code,
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        playerId,
      }
    );
  }

  if (!data) {
    return null;
  }

  const profile: DbPlayer = {
    id: String(data.id),
    full_name: data.full_name,
    position: data.position,
    headshot_url: data.headshot_url,
    team_id: data.team_id !== null ? String(data.team_id) : null,
  };

  return profile;
}

/**
 * 获取单个球员赛季统计（用于详情页，当前返回单赛季）
 */
export const fetchPlayerStats = unstable_cache(
  async (
    playerId: string | number,
    season: string = DEFAULT_SEASON
  ): Promise<DbPlayerSeasonStats | null> => {
    if (!playerId) {
      throw new PlayerFetchError("Player ID is required", "INVALID_PLAYER_ID");
    }

    if (!hasSupabaseConfig()) {
      throw new PlayerFetchError("Supabase 环境变量未配置", "MISSING_ENV_VARS");
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("player_season_stats")
      .select(
        `
        *,
        player:players!inner(
          *,
          team:teams(*)
        )
      `
      )
      .eq("player_id", playerId)
      .eq("season", season)
      .single();

    if (error) {
      throw new PlayerFetchError(
        `Failed to fetch player stats: ${error.message}`,
        error.code,
        {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          playerId,
          season,
        }
      );
    }

    if (!data) {
      return null;
    }

    const row = data as unknown as DatabasePlayerSeasonStats;
    const stat: DbPlayerSeasonStats = {
      player_id: row.player_id,
      season: row.season,
      pts: row.pts,
      reb: row.reb,
      ast: row.ast,
      stl: row.stl,
      blk: row.blk,
      fantasy_avg: row.fantasy_avg,
      player: row.player,
      team: row.player?.team ?? null,
    };

    return stat;
  },
  ["player-stats"],
  {
    tags: ["player-stats"],
    revalidate: 300,
  }
);

/**
 * 获取指定日期有比赛的球员列表
 * 
 * @param gameDate - 比赛日期，格式为 "YYYY-MM-DD" 或 Date 对象，如果不提供则使用配置的日期
 * @param season - 赛季，默认为 DEFAULT_SEASON
 * @returns Promise<Player[]> 球员列表
 */
export async function fetchPlayersWithGames(
  gameDate?: string | Date,
  season: string = DEFAULT_SEASON
): Promise<Player[]> {
  // If gameDate not provided, use configured date
  if (!gameDate) {
    gameDate = await getGameDate();
  }
  if (!hasSupabaseConfig()) {
    throw new PlayerFetchError("Supabase 环境变量未配置", "MISSING_ENV_VARS");
  }

  try {
    const supabase = createServerClient();

    // 1. 将日期转换为 Date 对象并计算日期范围（UTC）
    let dateStart: Date;
    let dateEnd: Date;

    if (typeof gameDate === "string") {
      // 解析日期字符串 "YYYY-MM-DD"
      const date = new Date(gameDate + "T00:00:00Z");
      dateStart = new Date(date);
      dateEnd = new Date(date);
      dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
    } else {
      dateStart = new Date(gameDate);
      dateStart.setUTCHours(0, 0, 0, 0);
      dateEnd = new Date(dateStart);
      dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
    }

    logger.info(
      `[fetchPlayersWithGames] Fetching players for games on ${dateStart.toISOString()} (season: ${season})`
    );

    // 2. 查询指定日期的比赛，获取所有涉及的 team_id
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select("home_team_id, away_team_id")
      .gte("game_date", dateStart.toISOString())
      .lt("game_date", dateEnd.toISOString())
      .eq("season", season);

    if (gamesError) {
      throw new PlayerFetchError(
        `Failed to fetch games: ${gamesError.message}`,
        gamesError.code,
        {
          message: gamesError.message,
          details: gamesError.details,
          hint: gamesError.hint,
          code: gamesError.code,
          gameDate: dateStart.toISOString(),
          season,
        }
      );
    }

    if (!gamesData || gamesData.length === 0) {
      logger.warn(
        `[fetchPlayersWithGames] No games found for date ${dateStart.toISOString()}`
      );
      return [];
    }

    // 3. 收集所有涉及的 team_id
    const teamIds = new Set<number>();
    gamesData.forEach((game) => {
      if (game.home_team_id !== null && game.home_team_id !== undefined) {
        teamIds.add(game.home_team_id);
      }
      if (game.away_team_id !== null && game.away_team_id !== undefined) {
        teamIds.add(game.away_team_id);
      }
    });

    if (teamIds.size === 0) {
      logger.warn(
        `[fetchPlayersWithGames] No valid team IDs found in games`
      );
      return [];
    }

    logger.info(
      `[fetchPlayersWithGames] Found ${gamesData.length} games with ${teamIds.size} teams`
    );

    // 4. 查询这些球队的球员赛季统计数据
    const { data: statsData, error: statsError } = await supabase
      .from("player_season_stats")
      .select(
        `
        *,
        player:players!inner(
          id,
          full_name,
          position,
          headshot_url,
          jersey_num,
          team_id,
          team:teams(
            id,
            name,
            code,
            logo_url
          )
        )
      `
      )
      .eq("season", season)
      .in("team_id", Array.from(teamIds))
      .order("fantasy_avg", { ascending: false });

    if (statsError) {
      throw new PlayerFetchError(
        `Failed to fetch player stats: ${statsError.message}`,
        statsError.code,
        {
          message: statsError.message,
          details: statsError.details,
          hint: statsError.hint,
          code: statsError.code,
          teamIds: Array.from(teamIds),
          season,
        }
      );
    }

    if (!statsData || statsData.length === 0) {
      logger.warn(
        `[fetchPlayersWithGames] No player stats found for teams ${Array.from(teamIds).join(", ")}`
      );
      return [];
    }

    logger.info(
      `[fetchPlayersWithGames] Found ${statsData.length} players with stats`
    );

    // 5. 转换为 Player 类型
    type Row = DatabasePlayerSeasonStats & {
      player: (DbPlayer & { team?: Team | null; jersey_num?: number | null }) | null;
    };

    const rows = statsData as unknown as Row[];

    const players: Player[] = rows
      .map((stat): Player | null => {
        if (!stat.player) {
          return null;
        }

        const team = stat.player.team;
        const teamName = team ? team.name : "Unknown Team";
        const teamLogo = team?.logo_url || undefined;

        const playerData: Player = {
          id: String(stat.player.id),
          name: stat.player.full_name,
          team: teamName,
          position:
            (stat.player.position as "PG" | "SG" | "SF" | "PF" | "C") || "C",
          avatar: stat.player.headshot_url || "",
          ppg: stat.pts || 0,
          rpg: stat.reb || 0,
          apg: stat.ast || 0,
          fantasyScore: stat.fantasy_avg || 0,
          teamLogo,
        };

        return playerData;
      })
      .filter((player): player is Player => player !== null);

    logger.info(
      `[fetchPlayersWithGames] Successfully transformed ${players.length} players`
    );

    return players;
  } catch (error) {
    if (error instanceof PlayerFetchError) {
      throw error;
    }

    const unknownError = new PlayerFetchError(
      `获取有比赛的球员数据时发生未知错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "UNKNOWN_ERROR",
      {
        originalError: error instanceof Error ? error.stack : String(error),
        gameDate: typeof gameDate === "string" ? gameDate : gameDate.toISOString(),
        season,
      }
    );
    logger.error("[fetchPlayersWithGames] 未知错误:", unknownError);
    throw unknownError;
  }
}

/**
 * League average stats for comparison
 */
export interface LeagueAverages {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fantasy_avg: number;
}

/**
 * Fetch league average stats from player_season_stats table
 * 
 * @param season - Season to calculate averages for
 * @returns Promise<LeagueAverages> League average stats
 */
export async function fetchLeagueAverages(
  season: string = DEFAULT_SEASON
): Promise<LeagueAverages> {
  // Default values if fetch fails
  const defaultAverages: LeagueAverages = {
    pts: 15,
    reb: 5,
    ast: 3,
    stl: 1,
    blk: 0.5,
    fantasy_avg: 25,
  };

  if (!hasSupabaseConfig()) {
    logger.warn("[fetchLeagueAverages] Supabase not configured, returning defaults");
    return defaultAverages;
  }

  try {
    const supabase = createServerClient();

    // Use Supabase's aggregate functions to calculate averages
    const { data, error } = await supabase
      .from("player_season_stats")
      .select("pts, reb, ast, stl, blk, fantasy_avg")
      .eq("season", season);

    if (error) {
      logger.error("[fetchLeagueAverages] Query error:", {
        message: error.message,
        code: error.code,
      });
      return defaultAverages;
    }

    if (!data || data.length === 0) {
      logger.warn("[fetchLeagueAverages] No data found for season:", season);
      return defaultAverages;
    }

    // Calculate averages manually
    const count = data.length;
    const totals = data.reduce(
      (acc, row) => ({
        pts: acc.pts + (row.pts || 0),
        reb: acc.reb + (row.reb || 0),
        ast: acc.ast + (row.ast || 0),
        stl: acc.stl + (row.stl || 0),
        blk: acc.blk + (row.blk || 0),
        fantasy_avg: acc.fantasy_avg + (row.fantasy_avg || 0),
      }),
      { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fantasy_avg: 0 }
    );

    const averages: LeagueAverages = {
      pts: Math.round((totals.pts / count) * 10) / 10,
      reb: Math.round((totals.reb / count) * 10) / 10,
      ast: Math.round((totals.ast / count) * 10) / 10,
      stl: Math.round((totals.stl / count) * 10) / 10,
      blk: Math.round((totals.blk / count) * 10) / 10,
      fantasy_avg: Math.round((totals.fantasy_avg / count) * 10) / 10,
    };

    logger.info("[fetchLeagueAverages] Calculated averages from", count, "players:", averages);

    return averages;
  } catch (error) {
    logger.error("[fetchLeagueAverages] Unexpected error:", error);
    return defaultAverages;
  }
}

/**
 * Cached version of fetchLeagueAverages
 */
export const getLeagueAverages = unstable_cache(
  fetchLeagueAverages,
  ["league-averages"],
  {
    tags: ["league-averages"],
    revalidate: 3600, // Cache for 1 hour
  }
);
