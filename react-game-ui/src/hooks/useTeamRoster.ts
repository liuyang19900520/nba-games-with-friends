import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_SEASON } from "@/config/constants";
import { logger } from "@/config/env";
import { fetchTeamInfo, fetchTeamRoster } from "@/services/teamService";
import type { PlayerStats, TeamDetail, TeamStats } from "@/types";
import type { PlayerSeasonStats, Team, TeamStanding } from "@/types/nba";

export interface UseTeamRosterOptions {
  teamId: number | null;
  season?: string;
  enabled?: boolean;
}

export interface UseTeamRosterReturn {
  teamDetail: TeamDetail | null;
  players: PlayerStats[];
  teamSummary: TeamStats;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom React hook for fetching team roster and calculating team summary stats
 *
 * @param options - Configuration options (teamId, season, enabled)
 * @returns Object with players data, calculated team summary, loading state, error, and refetch function
 *
 * @example
 * const { players, teamSummary, loading, error } = useTeamRoster({
 *   teamId: 1,
 *   season: '2025-26',
 * });
 */
export function useTeamRoster(
  options: UseTeamRosterOptions
): UseTeamRosterReturn {
  const { teamId, season = DEFAULT_SEASON, enabled = true } = options;

  const [roster, setRoster] = useState<PlayerSeasonStats[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [standing, setStanding] = useState<TeamStanding | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !teamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rosterResult, teamInfoResult] = await Promise.all([
        fetchTeamRoster({ teamId, season }),
        fetchTeamInfo({ teamId, season }),
      ]);

      if (rosterResult.error) {
        logger.error(
          "[useTeamRoster] Roster fetch error:",
          rosterResult.error.message
        );
        setError(rosterResult.error);
        setRoster([]);
      } else {
        setRoster(rosterResult.data || []);
      }

      if (teamInfoResult.error) {
        logger.error(
          "[useTeamRoster] Team info fetch error:",
          teamInfoResult.error.message
        );
        if (rosterResult.error) {
          setError(teamInfoResult.error);
        }
        setTeam(null);
        setStanding(null);
      } else if (teamInfoResult.data) {
        setTeam(teamInfoResult.data.team);
        setStanding(teamInfoResult.data.standing);
      }

      if (rosterResult.error && teamInfoResult.error) {
        setError(rosterResult.error);
      } else {
        setError(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      logger.error("[useTeamRoster] Unexpected error:", error);
      setError(error);
      setRoster([]);
      setTeam(null);
      setStanding(null);
    } finally {
      setLoading(false);
    }
  }, [teamId, season, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const players: PlayerStats[] = useMemo(() => {
    return roster
      .map((stat) => {
        const player = stat.player;
        if (!player) {
          return null;
        }

        return {
          id: String(player.id),
          name: player.full_name,
          position: (player.position as "PG" | "SG" | "SF" | "PF" | "C") || "C",
          avatar: player.headshot_url || "",
          pts: Number(stat.pts) || 0,
          reb: Number(stat.reb) || 0,
          ast: Number(stat.ast) || 0,
          stl: Number(stat.stl) || 0,
          blk: Number(stat.blk) || 0,
          tov: 0,
          fantasyScore: Number(stat.fantasy_avg) || 0,
          fantasyScores: [],
        };
      })
      .filter((player): player is PlayerStats => player !== null);
  }, [roster]);

  const teamSummary: TeamStats = useMemo(() => {
    const totals = roster.reduce(
      (acc, stat) => {
        return {
          ppg: acc.ppg + (Number(stat.pts) || 0),
          rpg: acc.rpg + (Number(stat.reb) || 0),
          apg: acc.apg + (Number(stat.ast) || 0),
          stl: acc.stl + (Number(stat.stl) || 0),
          blk: acc.blk + (Number(stat.blk) || 0),
          tov: acc.tov + 0,
        };
      },
      { ppg: 0, rpg: 0, apg: 0, stl: 0, blk: 0, tov: 0 }
    );

    return {
      ppg: Number(totals.ppg.toFixed(1)),
      rpg: Number(totals.rpg.toFixed(1)),
      apg: Number(totals.apg.toFixed(1)),
      stl: Number(totals.stl.toFixed(1)),
      blk: Number(totals.blk.toFixed(1)),
      tov: Number(totals.tov.toFixed(1)),
    };
  }, [roster]);

  const teamDetail: TeamDetail | null = useMemo(() => {
    if (!team) {
      return null;
    }

    const record = standing ? `${standing.wins}-${standing.losses}` : "0-0";

    return {
      id: team.id,
      name: team.nickname || team.name,
      logo: team.logo_url || undefined,
      rank: standing?.conf_rank || 0,
      record,
      conference: team.conference,
      stats: teamSummary,
      players,
    };
  }, [team, standing, teamSummary, players]);

  return {
    teamDetail,
    players,
    teamSummary,
    loading,
    error,
    refetch: fetchData,
  };
}
