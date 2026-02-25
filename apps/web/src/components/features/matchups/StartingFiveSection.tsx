'use client';

import Image from 'next/image';

interface PlayerCard {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  teamLogo: string;
  avatar: string;
  status: 'LIVE' | 'FINAL';
  pts: number;
  reb: number;
  ast: number;
  fpts: number;
}

interface StartingFiveSectionProps {
  players: PlayerCard[];
  totalScore: number;
}

export function StartingFiveSection({ players, totalScore }: StartingFiveSectionProps) {
  return (
    <div className="mb-8">
      {/* Header */}
      <h2 className="text-xl font-bold text-white mb-4">MY STARTING 5</h2>

      {/* Player Cards - Horizontal Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="flex-shrink-0 w-[140px] bg-brand-card rounded-xl border border-brand-card-border overflow-hidden relative"
            style={{ marginLeft: index > 0 ? '-20px' : '0' }}
          >
            {/* Status Badge */}
            <div
              className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold z-10 ${player.status === 'LIVE'
                ? 'bg-red-500 text-white'
                : 'bg-gray-600 text-white'
                }`}
            >
              {player.status}
            </div>

            {/* Player Avatar */}
            <div className="relative w-full h-32 bg-brand-dark/30">
              <Image
                src={player.avatar}
                alt={player.name}
                fill
                className="object-cover"
                sizes="140px"
              />
            </div>

            {/* Player Info */}
            <div className="p-3">
              {/* Name and Position */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {/* Team Logo */}
                  <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={player.teamLogo}
                      alt="Team"
                      width={20}
                      height={20}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Player Name */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {player.firstName}
                    </p>
                    <p className="text-xs font-semibold text-white truncate">
                      {player.lastName}
                    </p>
                  </div>
                </div>
                {/* Position Badge */}
                <div className="bg-brand-blue/20 text-brand-blue text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                  {player.position}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-brand-text-dim">PTS</span>
                  </div>
                  <span className="text-white font-semibold">{player.pts}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-brand-text-dim">REB</span>
                  </div>
                  <span className="text-white font-semibold">{player.reb}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-brand-text-dim">AST</span>
                  </div>
                  <span className="text-white font-semibold">{player.ast}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-card-border">
                  <div className="flex items-center gap-1">
                    <span className="text-brand-blue font-semibold">FPTS</span>
                  </div>
                  <span className="text-brand-blue font-bold text-sm">{player.fpts}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total Score */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-brand-text-dim mb-1">TODAY&apos;S TOTAL SCORE</p>
          <p className="text-3xl font-bold text-brand-blue">{totalScore.toFixed(1)} FPTS</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse"></div>
          <span className="text-xs text-brand-blue font-semibold">LIVE UPDATES</span>
        </div>
      </div>
    </div>
  );
}
