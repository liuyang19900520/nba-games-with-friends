'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { Player } from '@/types';

interface PlayerCardProps {
  player: Player;
  isActive?: boolean;
  onSelect: (player: Player) => void;
  priority?: boolean; // 是否优先加载（用于首屏球员）
}

export function PlayerCard({
  player,
  isActive = false,
  onSelect,
  priority = false
}: PlayerCardProps) {
  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(player);
  };

  return (
    <Link
      href={`/player/${player.id}`}
      className={`relative bg-brand-card p-3 rounded-xl border cursor-pointer transition-all block ${isActive
        ? 'border-brand-card-border-active shadow-glow-blue'
        : 'border-brand-card-border hover:border-brand-card-border-active'
        }`}
    >
      <div className="flex items-start justify-between">
        <Image
          src={player.avatar}
          alt={player.name}
          width={56}
          height={56}
          className={`w-14 h-14 rounded-full object-cover border-2 ${isActive ? 'border-yellow-400' : 'border-gray-500'
            }`}
          priority={priority}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQADAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        />
        <div className="text-right ml-2 flex-1">
          <p className="font-bold text-white text-sm leading-tight">{player.name}</p>
          <p className="text-xs text-brand-text-dim">{player.team}</p>
          <p className="text-xs text-brand-text-dim">{player.position}</p>
        </div>
      </div>
      <div className="flex items-end justify-between mt-3">
        {player.teamLogo && (
          <Image
            src={player.teamLogo}
            alt={`${player.team} logo`}
            width={32}
            height={32}
            className="w-8 h-8"
            loading="lazy"
          />
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
          onClick={handleSelect}
          className="w-7 h-7 bg-brand-blue/20 text-brand-blue rounded-full flex items-center justify-center text-xl font-light hover:bg-brand-blue/30 transition-colors"
          aria-label={`Select ${player.name}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </Link>
  );
}

