"use client";

import { useState } from "react";
import Image from "next/image";
import type { MatchPlayerStat } from "@/types";

interface PlayerStatsSectionProps {
  awayTeamPlayers: MatchPlayerStat[];
  homeTeamPlayers: MatchPlayerStat[];
  awayTeamName: string;
  homeTeamName: string;
}

type TeamTab = "away" | "home";

export function PlayerStatsSection({
  awayTeamPlayers,
  homeTeamPlayers,
  awayTeamName,
  homeTeamName,
}: PlayerStatsSectionProps) {
  const [activeTeam, setActiveTeam] = useState<TeamTab>("away");

  const currentPlayers =
    activeTeam === "away" ? awayTeamPlayers : homeTeamPlayers;

  // Helper to highlight high stats
  const isHighStat = (value: number, type: "pts" | "reb" | "ast"): boolean => {
    if (type === "pts") return value >= 20;
    if (type === "reb") return value >= 10;
    if (type === "ast") return value >= 8;
    return false;
  };

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-lg overflow-hidden">
      <h3 className="text-sm font-semibold text-white px-4 py-3 border-b border-brand-card-border">
        Player Statistics
      </h3>

      {/* Team Switcher Tabs */}
      <div className="flex border-b border-brand-card-border">
        <button
          onClick={() => setActiveTeam("away")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTeam === "away"
              ? "text-white bg-brand-dark/50 border-b-2 border-green-500"
              : "text-brand-text-dim hover:text-brand-text-light"
          }`}
        >
          {awayTeamName}
        </button>
        <button
          onClick={() => setActiveTeam("home")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTeam === "home"
              ? "text-white bg-brand-dark/50 border-b-2 border-blue-500"
              : "text-brand-text-dim hover:text-brand-text-light"
          }`}
        >
          {homeTeamName}
        </button>
      </div>

      {/* Player Stats Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-card-border bg-brand-dark/30">
              <th className="px-3 py-2 text-left text-xs font-medium text-brand-text-dim uppercase sticky left-0 bg-brand-dark/30 z-10">
                Player
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                Time
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                PTS
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                REB
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                AST
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                FG
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-text-dim uppercase">
                3PT
              </th>
            </tr>
          </thead>
          <tbody>
            {currentPlayers.map((player) => (
              <tr
                key={player.id}
                className="border-b border-brand-card-border last:border-b-0 hover:bg-brand-dark/20"
              >
                {/* Player Name with Avatar */}
                <td className="px-3 py-2 sticky left-0 bg-brand-card z-10">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    {player.avatar ? (
                      <div className="w-8 h-8 relative flex-shrink-0">
                        <Image
                          src={player.avatar}
                          alt={player.name}
                          fill
                          className="object-cover rounded-full"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center flex-shrink-0">
                        {player.number && (
                          <span className="text-xs font-bold text-brand-text-dim">
                            {player.number}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {player.name}
                      </p>
                      <p className="text-xs text-brand-text-dim">
                        {player.position}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Time */}
                <td className="px-3 py-2 text-right text-white">
                  {player.time}
                </td>

                {/* PTS */}
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    isHighStat(player.pts, "pts")
                      ? "text-yellow-400"
                      : "text-white"
                  }`}
                >
                  {player.pts}
                </td>

                {/* REB */}
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    isHighStat(player.reb, "reb")
                      ? "text-yellow-400"
                      : "text-white"
                  }`}
                >
                  {player.reb}
                </td>

                {/* AST */}
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    isHighStat(player.ast, "ast")
                      ? "text-yellow-400"
                      : "text-white"
                  }`}
                >
                  {player.ast}
                </td>

                {/* FG */}
                <td className="px-3 py-2 text-right text-white whitespace-nowrap">
                  {player.fg}
                </td>

                {/* 3PT */}
                <td className="px-3 py-2 text-right text-white whitespace-nowrap">
                  {player.threePt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
