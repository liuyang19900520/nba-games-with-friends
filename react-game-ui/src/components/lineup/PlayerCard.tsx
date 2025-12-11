import { Plus } from 'lucide-react';
import type { Player } from '../../types';

interface PlayerCardProps {
  player: Player;
  isActive?: boolean;
  onSelect: (player: Player) => void;
}

export function PlayerCard({ player, isActive = false, onSelect }: PlayerCardProps) {
  return (
    <div
      className={`relative bg-brand-card p-3 rounded-xl border ${
        isActive
          ? 'border-brand-card-border-active shadow-glow-blue'
          : 'border-brand-card-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <img
          src={player.avatar}
          alt={player.name}
          className={`w-14 h-14 rounded-full object-cover border-2 ${
            isActive ? 'border-yellow-400' : 'border-gray-500'
          }`}
        />
        <div className="text-right ml-2 flex-1">
          <p className="font-bold text-white text-sm leading-tight">{player.name}</p>
          <p className="text-xs text-brand-text-dim">{player.team}</p>
          <p className="text-xs text-brand-text-dim">{player.position}</p>
        </div>
      </div>
      <div className="flex items-end justify-between mt-3">
        {player.teamLogo && (
          <img src={player.teamLogo} alt={`${player.team} logo`} className="w-8 h-8" />
        )}
        <div className="text-center">
          <p className="text-xs text-brand-text-dim">PPG</p>
          <p className="font-bold text-sm text-white">{player.ppg}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-brand-text-dim">RPG</p>
          <p className="font-bold text-sm text-white">{player.rpg}</p>
        </div>
        <button
          onClick={() => onSelect(player)}
          className="w-7 h-7 bg-brand-blue/20 text-brand-blue rounded-full flex items-center justify-center text-xl font-light hover:bg-brand-blue/30 transition-colors"
          aria-label={`Select ${player.name}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

