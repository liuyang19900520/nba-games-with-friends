import { unstable_cache } from "next/cache";
import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { DEFAULT_SEASON } from "@/config/constants";
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
      console.warn(
        `[fetchPlayers] 查询成功但未返回数据。赛季: ${season}, 表: player_season_stats`
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
