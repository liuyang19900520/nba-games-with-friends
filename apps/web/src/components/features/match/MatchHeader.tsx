"use client";

import Image from "next/image";
import { format } from "date-fns";
import type { MatchDetail } from "@/types";

interface MatchHeaderProps {
  match: MatchDetail;
}

export function MatchHeader({ match }: MatchHeaderProps) {
  const formatGameDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, yyyy • h:mm a");
    } catch {
      return "";
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Final":
        return "text-brand-text-dim";
      case "Live":
        return "text-red-500";
      case "Scheduled":
        return "text-blue-400";
      default:
        return "text-brand-text-dim";
    }
  };

  return (
    <div className="bg-brand-card border-b border-brand-card-border">
      {/* Status and Date */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className={`text-sm font-medium ${getStatusColor(match.status)}`}>
          {match.status}
        </span>
        <span className="text-xs text-brand-text-dim">
          {formatGameDate(match.gameDate)}
        </span>
      </div>

      {/* Teams and Score */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {match.awayTeam.logoUrl ? (
              <div className="w-16 h-16 relative">
                <Image
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-xs font-bold text-brand-text-dim">
                  {match.awayTeam.code}
                </span>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {match.awayTeam.name}
              </p>
              {match.awayTeam.rank && match.awayTeam.conference && (
                <p className="text-xs text-brand-text-dim">
                  {match.awayTeam.conference} {match.awayTeam.rank}
                </p>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{match.awayTeam.score}</p>
          </div>

          {/* Score Separator */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-xl text-brand-text-dim font-medium">:</span>
          </div>

          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {match.homeTeam.logoUrl ? (
              <div className="w-16 h-16 relative">
                <Image
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-dark border border-brand-card-border flex items-center justify-center">
                <span className="text-xs font-bold text-brand-text-dim">
                  {match.homeTeam.code}
                </span>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {match.homeTeam.name}
              </p>
              {match.homeTeam.rank && match.homeTeam.conference && (
                <p className="text-xs text-brand-text-dim">
                  {match.homeTeam.conference} {match.homeTeam.rank}
                </p>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{match.homeTeam.score}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
