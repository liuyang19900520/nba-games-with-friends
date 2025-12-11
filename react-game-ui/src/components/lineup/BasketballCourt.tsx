import type { Player } from '../../types';
import { NeonCourtOverlay } from './NeonCourtOverlay';

interface BasketballCourtProps {
  lineup: {
    PG?: Player;
    SG?: Player;
    SF?: Player;
    PF?: Player;
    C?: Player;
  };
  onSlotClick: (position: 'PG' | 'SG' | 'SF' | 'PF' | 'C') => void;
}

export function BasketballCourt({ lineup, onSlotClick }: BasketballCourtProps) {
  // Half court positions:
  // - C (Center): Near basket, left side of key
  // - PF (Power Forward): Near basket, right side of key
  // - SF (Small Forward): Outside three-point line, left side
  // - PG (Point Guard): Outside three-point line, center
  // - SG (Shooting Guard): Outside three-point line, right side
  const positions: Array<{
    position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
    style: string;
  }> = [
    { position: 'C', style: 'bottom-[18%] right-[32.5%]' }, // Symmetric to PF (PF at left 32.5%, C at right 32.5%)
    { position: 'PF', style: 'bottom-[18%] left-[32.5%]' }, // Between SF and PG (SF at 15%, PG at 50%)
    { position: 'SF', style: 'bottom-[45%] left-[15%]' }, // Outside three-point line, left
    { position: 'PG', style: 'bottom-[47%] left-1/2 -translate-x-1/2' }, // Outside three-point line, center
    { position: 'SG', style: 'bottom-[45%] right-[15%]' }, // Outside three-point line, right
  ];

  return (
    <div className="basketball-court-container relative">
      <NeonCourtOverlay />
      {positions.map(({ position, style }) => {
        const player = lineup[position];
        return (
          <div
            key={position}
            className={`player-slot ${style}`}
            onClick={() => onSlotClick(position)}
          >
            <div className="player-slot-circle">
              {player ? (
                <img
                  src={player.avatar}
                  alt={player.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="player-slot-plus">+</span>
              )}
            </div>
            <span>{position}</span>
          </div>
        );
      })}
    </div>
  );
}
