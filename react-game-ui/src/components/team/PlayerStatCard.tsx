import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlayerStats } from '@/types';
import { CircularProgress } from './CircularProgress';
import { LineChart } from './LineChart';
import { HorizontalProgress } from './HorizontalProgress';
import { RadarChart } from './RadarChart';

interface PlayerStatCardProps {
  player: PlayerStats;
}

export function PlayerStatCard({ player }: PlayerStatCardProps) {
  const navigate = useNavigate();
  const ptsPercentage = Math.min((player.pts / 35) * 100, 100); // Assuming max 35 pts

  const handleClick = () => {
    navigate(`/player/${player.id}`);
  };

  return (
    <div
      className="bg-brand-card border border-brand-card-border rounded-xl p-4 hover:border-brand-card-border-active transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-start gap-4">
        {/* Player Avatar */}
        <img
          src={player.avatar}
          alt={player.name}
          className="w-16 h-16 rounded-full object-cover border-2 border-brand-card-border flex-shrink-0"
        />

        {/* Player Info & Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white uppercase">
              {player.name} ({player.position})
            </h4>
            <ChevronRight className="w-5 h-5 text-brand-text-dim flex-shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {/* PTS with Circular Progress */}
            <div className="flex flex-col items-center">
              <CircularProgress
                value={ptsPercentage}
                size={48}
                strokeColor="#F5A623"
                displayValue={player.pts}
              />
              <p className="text-xs text-brand-text-dim mt-1">PTS</p>
            </div>

            {/* REB */}
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-brand-blue">{player.reb}</p>
              <p className="text-xs text-brand-text-dim mt-1">REB</p>
            </div>

            {/* AST */}
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-green-500">{player.ast}</p>
              <p className="text-xs text-brand-text-dim mt-1">AST</p>
            </div>
          </div>

          {/* Additional Stats / Charts */}
          <div className="mt-3">
            {player.recentGames && (
              <div className="flex items-center justify-end">
                <LineChart data={player.recentGames} color="#F5A623" width={120} height={30} />
              </div>
            )}

            {player['3pt%'] !== undefined && (
              <div className="flex items-center justify-end mt-2">
                <div className="w-32">
                  <HorizontalProgress
                    value={player['3pt%']}
                    max={100}
                    label="3PT%"
                    color="#F5A623"
                  />
                </div>
              </div>
            )}

            {player.radarStats && (
              <div className="flex items-center justify-end mt-2">
                <RadarChart stats={player.radarStats} size={60} />
              </div>
            )}

            {player.defRating !== undefined && (
              <div className="flex items-center justify-end mt-2">
                <div className="w-32">
                  <HorizontalProgress
                    value={player.defRating}
                    max={120}
                    label="DEF RATING"
                    color="#A855F7"
                    reverse
                  />
                </div>
              </div>
            )}

            {player.stl !== undefined && (
              <div className="flex items-center justify-end mt-2">
                <p className="text-xs text-brand-text-dim">
                  STL: <span className="text-purple-400 font-bold">{player.stl}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

