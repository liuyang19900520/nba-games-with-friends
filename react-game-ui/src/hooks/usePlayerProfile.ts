import { useEffect, useState } from "react";

import { DEFAULT_SEASON } from "@/config/constants";
import { fetchPlayerProfile } from "@/services/playerService";
import type { PlayerDetail } from "@/types";
import type { PlayerSeasonStats } from "@/types/nba";

export interface UsePlayerProfileOptions {
  playerId: string | number;
  season?: string;
}

export interface UsePlayerProfileReturn {
  player: PlayerDetail | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook to fetch and transform player profile data
 *
 * Fetches player season stats from Supabase and transforms it into
 * the PlayerDetail format expected by the UI components.
 *
 * @param options - Hook options (playerId, season)
 * @returns Player profile data, loading state, and error
 */
export function usePlayerProfile(
  options: UsePlayerProfileOptions
): UsePlayerProfileReturn {
  const { playerId, season = DEFAULT_SEASON } = options;
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      setError(new Error("Player ID is required"));
      return;
    }

    setLoading(true);
    setError(null);

    fetchPlayerProfile({ playerId, season })
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setPlayer(null);
          return;
        }

        if (!result.data) {
          setError(new Error("Player profile not found"));
          setPlayer(null);
          return;
        }

        const profile = transformToPlayerDetail(result.data);
        setPlayer(profile);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch player profile")
        );
        setPlayer(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [playerId, season]);

  return { player, loading, error };
}

/**
 * Transform PlayerSeasonStats to PlayerDetail for UI consumption
 */
function transformToPlayerDetail(stat: PlayerSeasonStats): PlayerDetail {
  const player = stat.player;
  const team = stat.team;

  const teamName = team ? `${team.city} ${team.name}` : "Unknown Team";

  const position = player.position || "N/A";
  const jerseyNumber = "#00";

  return {
    id: String(player.id),
    name: player.full_name,
    position,
    jerseyNumber,
    team: teamName,
    teamLogo: team?.logo_url || undefined,
    avatar: player.headshot_url || "",
    ppg: stat.pts,
    rpg: stat.reb,
    apg: stat.ast,
    stl: stat.stl,
    blk: stat.blk,
    tov: 0,
    fantasyScore: stat.fantasy_avg,
    clutchTimeStats: {
      points: { player: 0, league: 0, percentile: 0 },
      assists: { player: 0, league: 0, percentile: 0 },
      rebounds: { player: 0, league: 0, percentile: 0 },
    },
    shotChart: {
      fgPercentage: 0,
      threePointPercentage: 0,
    },
    leagueComparison: {
      scoring: 50,
      playmaking: 50,
      rebounding: 50,
      defense: 50,
      efficiency: 50,
      leagueMean: {
        scoring: 50,
        playmaking: 50,
        rebounding: 50,
        defense: 50,
        efficiency: 50,
      },
    },
    recentGames: [],
  };
}
