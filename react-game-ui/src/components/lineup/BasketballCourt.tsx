'use client';

import Image from 'next/image';
import type { Player } from '@/types';
import { NeonCourtOverlay } from './NeonCourtOverlay';

interface BasketballCourtProps {
  lineup: {
    C?: Player;
    F1?: Player;
    F2?: Player;
    G1?: Player;
    G2?: Player;
  };
  onSlotClick: (position: 'C' | 'F1' | 'F2' | 'G1' | 'G2') => void;
  isPending?: boolean; // 是否正在保存（用于乐观更新状态）
}

export function BasketballCourt({ lineup, onSlotClick, isPending = false }: BasketballCourtProps) {
  // Half court positions:
  // - C (Center): 1 position near basket
  // - F1, F2 (Forwards): 2 positions near basket
  // - G1, G2 (Guards): 2 positions outside three-point line
  const positions: Array<{
    position: 'C' | 'F1' | 'F2' | 'G1' | 'G2';
    label: string;
    style: string;
  }> = [
      { position: 'C', label: 'C', style: 'bottom-[55%] left-1/2 -translate-x-1/2' }, // Center near basket
      { position: 'F1', label: 'F', style: 'bottom-[45%] left-[15%]' }, // Forward 1 near basket, left
      { position: 'F2', label: 'F', style: 'bottom-[45%] right-[15%]' }, // Forward 2 near basket, right
      { position: 'G1', label: 'G', style: 'bottom-[15%] left-[32.5%]' }, // Guard 1 outside three-point line, left
      { position: 'G2', label: 'G', style: 'bottom-[15%] right-[32.5%]' }, // Guard 2 outside three-point line, right
    ];

  return (
    <div className="basketball-court-container relative">
      <NeonCourtOverlay />
      {positions.map(({ position, label, style }) => {
        const player = lineup[position];
        return (
          <div
            key={position}
            className={`player-slot ${style}`}
            onClick={() => onSlotClick(position)}
          >
            <div className={`player-slot-circle ${isPending ? 'opacity-75' : ''}`}>
              {player ? (
                <Image
                  src={player.avatar}
                  alt={player.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="player-slot-plus">+</span>
              )}
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
