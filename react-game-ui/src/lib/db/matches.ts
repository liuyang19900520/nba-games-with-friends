import { createServerClient, hasSupabaseConfig } from "./supabase-server";
import { logger } from "@/config/env";
import type { MatchDetail } from "@/types";

/**
 * Fetch match detail by match ID from Supabase
 */
export async function fetchMatchDetail(
  matchId: string
): Promise<MatchDetail | null> {
  // Check if Supabase is configured
  if (!hasSupabaseConfig()) {
    logger.warn(
      "[fetchMatchDetail] Supabase not configured, returning mock data"
    );
    return getMockMatchDetail(matchId);
  }

  try {
    const supabase = createServerClient();
    logger.info(`[fetchMatchDetail] Fetching match ${matchId} from database`);

    // Step 1: Fetch game data
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select(
        "id, season, game_date, status, is_playoff, home_score, away_score, home_team_id, away_team_id, arena_name"
      )
      .eq("id", matchId)
      .single();

    if (gameError) {
      logger.error("[fetchMatchDetail] Failed to fetch game:", {
        message: gameError.message,
        code: gameError.code,
      });
      // Fallback to mock data if game not found
      return getMockMatchDetail(matchId);
    }

    if (!gameData) {
      logger.warn(`[fetchMatchDetail] Game ${matchId} not found`);
      return null;
    }

    // Step 2: Fetch team data
    const teamIds = [gameData.home_team_id, gameData.away_team_id].filter(
      (id): id is number => id !== null && id !== undefined
    );

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, code, logo_url, conference")
      .in("id", teamIds);

    if (teamsError) {
      logger.error("[fetchMatchDetail] Failed to fetch teams:", teamsError);
    }

    const teamsMap = new Map((teamsData || []).map((team) => [team.id, team]));

    const homeTeam = teamsMap.get(gameData.home_team_id || 0);
    const awayTeam = teamsMap.get(gameData.away_team_id || 0);

    if (!homeTeam || !awayTeam) {
      logger.warn("[fetchMatchDetail] Missing team data, using mock");
      return getMockMatchDetail(matchId);
    }

    // Step 3: Fetch player stats for this game
    const { data: playerStatsData, error: playerStatsError } = await supabase
      .from("game_player_stats")
      .select(
        `
        *,
        player:players!inner(
          id,
          full_name,
          position,
          headshot_url,
          jersey_number
        )
      `
      )
      .eq("game_id", matchId)
      .order("fantasy_score", { ascending: false });

    if (playerStatsError) {
      logger.error("[fetchMatchDetail] Failed to fetch player stats:", {
        message: playerStatsError.message,
        code: playerStatsError.code,
      });
      // Continue with empty player stats rather than failing completely
    }

    // Step 4: Organize player stats by team
    const awayTeamPlayers =
      playerStatsData
        ?.filter((stat) => stat.team_id === gameData.away_team_id)
        .map((stat) => transformPlayerStat(stat)) || [];
    const homeTeamPlayers =
      playerStatsData
        ?.filter((stat) => stat.team_id === gameData.home_team_id)
        .map((stat) => transformPlayerStat(stat)) || [];

    // Step 5: Generate game type
    let gameType = "NBA Regular Season";
    if (gameData.is_playoff) {
      gameType = "NBA Playoffs";
    } else if (gameData.season) {
      gameType = `${gameData.season} Regular Season`;
    }

    // Step 6: Build match detail object
    const matchDetail: MatchDetail = {
      id: String(gameData.id),
      status:
        (gameData.status as "Scheduled" | "Live" | "Final") || "Scheduled",
      gameDate: gameData.game_date || new Date().toISOString(),
      gameType,
      arenaName: gameData.arena_name || undefined,
      awayTeam: {
        id: String(awayTeam.id),
        name: awayTeam.name,
        code: awayTeam.code,
        logoUrl: awayTeam.logo_url,
        score: gameData.away_score ?? 0,
      },
      homeTeam: {
        id: String(homeTeam.id),
        name: homeTeam.name,
        code: homeTeam.code,
        logoUrl: homeTeam.logo_url,
        score: gameData.home_score ?? 0,
      },
      quarters: {
        q1: { away: 0, home: 0 },
        q2: { away: 0, home: 0 },
        q3: { away: 0, home: 0 },
        q4: { away: 0, home: 0 },
        total: {
          away: gameData.away_score ?? 0,
          home: gameData.home_score ?? 0,
        },
      },
      awayTeamPlayers,
      homeTeamPlayers,
    };

    logger.info(
      `[fetchMatchDetail] Successfully fetched match ${matchId} with ${awayTeamPlayers.length} away players and ${homeTeamPlayers.length} home players`
    );

    return matchDetail;
  } catch (err) {
    logger.error("[fetchMatchDetail] Unexpected error:", err);
    return getMockMatchDetail(matchId);
  }
}

/**
 * Transform database player stat to MatchPlayerStat
 * Based on actual game_player_stats table structure:
 * - min: text (format: "MM:SS")
 * - fgm, fga: integer (field goals made/attempted)
 * - fg3m, fg3a: integer (3-point field goals made/attempted)
 */
function transformPlayerStat(stat: {
  player_id: string | number;
  team_id: number | null;
  pts?: number | null;
  reb?: number | null;
  ast?: number | null;
  fgm?: number | null;
  fga?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  min?: string | null;
  player?: {
    id: string | number;
    full_name?: string | null;
    position?: string | null;
    headshot_url?: string | null;
    jersey_number?: number | string | null;
  } | null;
}): {
  id: string;
  name: string;
  number?: string;
  avatar?: string;
  position: string;
  time: string;
  pts: number;
  reb: number;
  ast: number;
  fg: string;
  threePt: string;
} {
  const player = stat.player;
  const fgMade = stat.fgm ?? 0;
  const fgAttempted = stat.fga ?? 0;
  const threePtMade = stat.fg3m ?? 0;
  const threePtAttempted = stat.fg3a ?? 0;

  // min is already in "MM:SS" format, use as-is or default to "0:00"
  const time = stat.min || "0:00";

  return {
    id: String(player?.id || stat.player_id),
    name: player?.full_name || "Unknown",
    number: player?.jersey_number?.toString(),
    avatar: player?.headshot_url || undefined,
    position: player?.position || "",
    time,
    pts: Number(stat.pts || 0),
    reb: Number(stat.reb || 0),
    ast: Number(stat.ast || 0),
    fg: `${fgMade}-${fgAttempted}`,
    threePt: `${threePtMade}-${threePtAttempted}`,
  };
}

/**
 * Mock match detail data
 * Replace with actual database query when ready
 */
function getMockMatchDetail(matchId: string): MatchDetail {
  return {
    id: matchId,
    status: "Final",
    gameDate: "2025-12-25T10:30:00+00:00",
    gameType: "NBA Regular Season",
    arenaName: "Crypto.com Arena",
    awayTeam: {
      id: "1610612762",
      name: "Jazz",
      code: "UTA",
      logoUrl: "https://cdn.nba.com/logos/nba/1610612762/global/L/logo.svg",
      score: 108,
      rank: 12,
      conference: "West",
    },
    homeTeam: {
      id: "1610612746",
      name: "Clippers",
      code: "LAC",
      logoUrl: "https://cdn.nba.com/logos/nba/1610612746/global/L/logo.svg",
      score: 120,
      rank: 4,
      conference: "West",
    },
    quarters: {
      q1: { away: 28, home: 32 },
      q2: { away: 25, home: 30 },
      q3: { away: 30, home: 28 },
      q4: { away: 25, home: 30 },
      total: { away: 108, home: 120 },
    },
    scoreTrend: [
      { time: "Q1 0:00", awayScore: 0, homeScore: 0, diff: 0 },
      { time: "Q1 6:00", awayScore: 12, homeScore: 15, diff: 3 },
      { time: "Q1 3:00", awayScore: 20, homeScore: 25, diff: 5 },
      { time: "Q1 0:00", awayScore: 28, homeScore: 32, diff: 4 },
      { time: "Q2 6:00", awayScore: 38, homeScore: 45, diff: 7 },
      { time: "Q2 3:00", awayScore: 48, homeScore: 55, diff: 7 },
      { time: "Q2 0:00", awayScore: 53, homeScore: 62, diff: 9 },
      { time: "Q3 6:00", awayScore: 65, homeScore: 75, diff: 10 },
      { time: "Q3 3:00", awayScore: 78, homeScore: 88, diff: 10 },
      { time: "Q3 0:00", awayScore: 83, homeScore: 90, diff: 7 },
      { time: "Q4 6:00", awayScore: 95, homeScore: 105, diff: 10 },
      { time: "Q4 3:00", awayScore: 102, homeScore: 115, diff: 13 },
      { time: "Q4 0:00", awayScore: 108, homeScore: 120, diff: 12 },
    ],
    awayTeamPlayers: [
      {
        id: "1",
        name: "Lauri Markkanen",
        number: "23",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1628378.png",
        position: "PF",
        time: "35:12",
        pts: 28,
        reb: 10,
        ast: 3,
        fg: "10-18",
        threePt: "4-8",
      },
      {
        id: "2",
        name: "Collin Sexton",
        number: "2",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1629012.png",
        position: "PG",
        time: "32:45",
        pts: 22,
        reb: 4,
        ast: 8,
        fg: "9-16",
        threePt: "2-5",
      },
      {
        id: "3",
        name: "Jordan Clarkson",
        number: "00",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/203903.png",
        position: "SG",
        time: "28:30",
        pts: 18,
        reb: 3,
        ast: 5,
        fg: "7-14",
        threePt: "3-7",
      },
      {
        id: "4",
        name: "Walker Kessler",
        number: "24",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1631117.png",
        position: "C",
        time: "25:15",
        pts: 12,
        reb: 8,
        ast: 1,
        fg: "5-9",
        threePt: "0-0",
      },
      {
        id: "5",
        name: "Ochai Agbaji",
        number: "30",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1630534.png",
        position: "SF",
        time: "24:20",
        pts: 10,
        reb: 5,
        ast: 2,
        fg: "4-10",
        threePt: "2-6",
      },
    ],
    homeTeamPlayers: [
      {
        id: "6",
        name: "Kawhi Leonard",
        number: "2",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/202695.png",
        position: "SF",
        time: "38:20",
        pts: 32,
        reb: 8,
        ast: 6,
        fg: "12-20",
        threePt: "4-8",
      },
      {
        id: "7",
        name: "Paul George",
        number: "13",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/202331.png",
        position: "SG",
        time: "36:15",
        pts: 28,
        reb: 6,
        ast: 5,
        fg: "11-18",
        threePt: "5-10",
      },
      {
        id: "8",
        name: "James Harden",
        number: "1",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/201935.png",
        position: "PG",
        time: "34:30",
        pts: 24,
        reb: 4,
        ast: 12,
        fg: "8-15",
        threePt: "3-7",
      },
      {
        id: "9",
        name: "Ivica Zubac",
        number: "40",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1627826.png",
        position: "C",
        time: "28:45",
        pts: 16,
        reb: 12,
        ast: 2,
        fg: "7-11",
        threePt: "0-0",
      },
      {
        id: "10",
        name: "Norman Powell",
        number: "24",
        avatar: "https://cdn.nba.com/headshots/nba/latest/260x190/1626181.png",
        position: "SG",
        time: "26:10",
        pts: 14,
        reb: 3,
        ast: 2,
        fg: "5-9",
        threePt: "2-4",
      },
    ],
  };
}
