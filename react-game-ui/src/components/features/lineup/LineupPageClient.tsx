'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BasketballCourt } from '@/components/lineup/BasketballCourt';
import { PlayerCard } from '@/components/lineup/PlayerCard';
import type { Player } from '@/types';
import type { User } from '@supabase/supabase-js';

interface LineupPageClientProps {
  players: Player[];
  user: User | null;
}

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
type LineupState = Partial<Record<Position, Player>>;

/**
 * Lineup Page Client Component
 *
 * Uses React 19's useOptimistic for optimistic updates:
 * - UI updates immediately when user selects players, no need to wait for server response
 * - After implementing Server Actions in Step 5, actual save operations will be called here
 *
 * Handles user interactions and game state management.
 * Receives player data passed from Server Component.
 * 
 * Note: If user is null, page is in read-only mode, user needs to log in to save lineup
 */
export function LineupPageClient({ players, user }: LineupPageClientProps) {
  const router = useRouter();
  const isReadOnly = !user;
  // Actual state (will eventually sync to server)
  const [lineup, setLineup] = useState<LineupState>({});

  // React 19 Optimistic UI: optimistic state, immediately reflects user actions
  const [optimisticLineup, updateOptimisticLineup] = useOptimistic(
    lineup,
    (currentState: LineupState, newState: LineupState) => {
      // Merge new state, optimistic update
      return { ...currentState, ...newState };
    }
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Handle player selection - using optimistic updates
   * 
   * If user is not logged in, allow viewing but prompt to log in to save
   */
  const handlePlayerSelect = (player: Player) => {
    // Unauthenticated users can view and select, but cannot save
    if (isReadOnly) {
      // Allow local preview, but don't save to server
      startTransition(() => {
        let newLineup: LineupState;

        if (selectedPosition) {
          newLineup = {
            ...lineup,
            [selectedPosition]: player,
          };
        } else {
          const availablePositions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
          const emptyPosition = availablePositions.find((pos) => !lineup[pos]);
          if (emptyPosition) {
            newLineup = {
              ...lineup,
              [emptyPosition]: player,
            };
          } else {
            return;
          }
        }

        updateOptimisticLineup(newLineup);
        setLineup(newLineup);
        setSelectedPosition(null);
        setSelectedPlayerId(player.id);
      });
      return;
    }

    // Logged-in user: normal flow
    startTransition(() => {
      let newLineup: LineupState;

      if (selectedPosition) {
        // If position already selected, place directly
        newLineup = {
          ...lineup,
          [selectedPosition]: player,
        };
      } else {
        // Automatically select first available position
        const availablePositions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
        const emptyPosition = availablePositions.find((pos) => !lineup[pos]);
        if (emptyPosition) {
          newLineup = {
            ...lineup,
            [emptyPosition]: player,
          };
        } else {
          // All positions full, don't update
          return;
        }
      }

      // Optimistic update: immediately display on UI
      updateOptimisticLineup(newLineup);

      // Actual state update (will sync to server in the future)
      setLineup(newLineup);
      setSelectedPosition(null);
      setSelectedPlayerId(player.id);

      // TODO: Step 5 - Call Server Action
      // await saveLineupAction(newLineup);
    });
  };


  const handleSlotClick = (position: Position) => {
    setSelectedPosition(position);
    // Remove player from this position if clicking on occupied slot
    if (optimisticLineup[position]) {
      startTransition(() => {
        const newLineup = { ...optimisticLineup };
        delete newLineup[position];

        // Optimistic update
        updateOptimisticLineup(newLineup);

        // Actual state update
        setLineup(newLineup);
      });
    }
  };

  const selectedCount = Object.keys(optimisticLineup).length;

  return (
    <>
      {/* Basketball Court - using optimistic state */}
      <section className="px-4 pt-4">
        <div className="bg-brand-dark/60 backdrop-blur-sm rounded-xl p-3">
          <BasketballCourt
            lineup={optimisticLineup}
            onSlotClick={handleSlotClick}
            isPending={isPending}
          />
        </div>
      </section>

      {/* Read-only Notice */}
      {isReadOnly && (
        <section className="px-4 pt-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
            <p className="text-sm text-yellow-400 text-center">
              🔒 View-only mode. <button onClick={() => router.push('/login?redirect=/lineup')} className="underline font-medium">Sign in</button> to save your lineup.
            </p>
          </div>
        </section>
      )}

      {/* Player Selection Prompt */}
      <section className="mt-4 px-4">
        <h2 className="text-xl font-bold text-center text-white">
          Select <span className="text-brand-blue">5 Players</span> for Today
          {selectedCount > 0 && (
            <span className="ml-2 text-brand-text-dim">
              ({selectedCount}/5)
            </span>
          )}
          {isPending && (
            <span className="ml-2 text-xs text-brand-text-dim animate-pulse">
              (saving...)
            </span>
          )}
        </h2>

        {/* Player Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              isActive={selectedPlayerId === player.id}
              onSelect={handlePlayerSelect}
              priority={index < 4} // First 4 players use priority loading
            />
          ))}
        </div>
      </section>
    </>
  );
}
