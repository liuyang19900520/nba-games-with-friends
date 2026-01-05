'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BasketballCourt } from '@/components/lineup/BasketballCourt';
import { PlayerSearchSection } from '@/components/features/lineup/PlayerSearchSection';
import { submitLineup } from '@/app/lineup/actions';
import type { Player } from '@/types';
import type { User } from '@supabase/supabase-js';

interface InitialLineup {
  id: number;
  status: string;
  gameDate: string;
  totalScore: number;
  items: Array<{
    playerId: string;
    position: string;
  }>;
}

interface LineupPageClientProps {
  players: Player[];
  user: User | null;
  initialLineup?: InitialLineup | null;
}

// New position system: 1 C, 2 F, 2 G
type Position = 'C' | 'F1' | 'F2' | 'G1' | 'G2';
type LineupState = Partial<Record<Position, Player>>;

// Helper to get base position from Position (C, F, or G)
function getBasePosition(position: Position): 'C' | 'F' | 'G' {
  if (position === 'C') return 'C';
  if (position.startsWith('F')) return 'F';
  if (position.startsWith('G')) return 'G';
  return 'C'; // fallback
}

/**
 * Build initial lineup state from server data
 */
function buildInitialLineup(
  initialLineup: InitialLineup | null | undefined,
  players: Player[]
): LineupState {
  if (!initialLineup || !initialLineup.items.length) {
    return {};
  }

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const result: LineupState = {};

  // Map database positions (C, F, G) to new positions (C, F1, F2, G1, G2)
  // Priority: C -> C, F -> F1 then F2, G -> G1 then G2
  const fPositions: Position[] = ['F1', 'F2'];
  const gPositions: Position[] = ['G1', 'G2'];
  let fIndex = 0;
  let gIndex = 0;

  for (const item of initialLineup.items) {
    const dbPosition = item.position.toUpperCase(); // C, F, or G
    const player = playerMap.get(item.playerId);

    if (player) {
      if (dbPosition === 'C') {
        result['C'] = player;
      } else if (dbPosition === 'F' && fIndex < fPositions.length) {
        result[fPositions[fIndex]] = player;
        fIndex++;
      } else if (dbPosition === 'G' && gIndex < gPositions.length) {
        result[gPositions[gIndex]] = player;
        gIndex++;
      }
    }
  }

  return result;
}

/**
 * Lineup Page Client Component
 *
 * Uses React 19's useOptimistic for optimistic updates:
 * - UI updates immediately when user selects players, no need to wait for server response
 * - Server Actions handle actual data persistence
 *
 * Handles user interactions and game state management.
 * Receives player data passed from Server Component.
 * 
 * Note: If user is null, page is in read-only mode, user needs to log in to save lineup
 */
export function LineupPageClient({ players, user, initialLineup }: LineupPageClientProps) {
  const router = useRouter();
  const isReadOnly = !user;

  // Check if lineup is already submitted
  const [isSubmitted, setIsSubmitted] = useState(
    initialLineup?.status === 'submitted' || initialLineup?.status === 'settled'
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Actual state (will eventually sync to server)
  const [lineup, setLineup] = useState<LineupState>(() =>
    buildInitialLineup(initialLineup, players)
  );

  // React 19 Optimistic UI: optimistic state, immediately reflects user actions
  const [optimisticLineup, updateOptimisticLineup] = useOptimistic(
    lineup,
    (currentState: LineupState, newState: LineupState) => {
      // Merge new state, optimistic update
      return { ...currentState, ...newState };
    }
  );

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [selectedFilterPosition, setSelectedFilterPosition] = useState<'C' | 'F' | 'G' | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSlotClick = (position: Position) => {
    // Don't allow modifications if submitted
    if (isSubmitted) return;

    setSelectedPosition(position);

    // Set filter to match the clicked position
    const basePosition = getBasePosition(position);
    setSelectedFilterPosition(basePosition);

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

  /**
   * Handle adding a player from PlayerSearchSection
   */
  const handleAddPlayer = (player: Player) => {
    // Don't allow modifications if submitted
    if (isSubmitted) return;

    startTransition(() => {
      let newLineup: LineupState;

      if (selectedPosition) {
        // If a position is already selected, place player there
        newLineup = {
          ...lineup,
          [selectedPosition]: player,
        };
        setSelectedPosition(null);
      } else {
        // Automatically select first available position
        // Priority: C, then F1/F2, then G1/G2
        const availablePositions: Position[] = ['C', 'F1', 'F2', 'G1', 'G2'];
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

      // Actual state update
      setLineup(newLineup);
    });
  };

  // Get list of selected player IDs for PlayerSearchSection
  const selectedPlayerIds = Object.values(optimisticLineup).map((player) => player.id);

  /**
   * Handle lineup submission
   */
  const handleSubmit = async () => {
    // Check if user is logged in
    if (!user) {
      router.push('/login?redirect=/lineup');
      return;
    }

    // Validate 5 players selected
    const selectedCount = Object.keys(lineup).length;
    if (selectedCount !== 5) {
      setSubmitError('Please select exactly 5 players');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Build players array for submission
      // Convert new position format (C, F1, F2, G1, G2) to database format (C, F, G)
      const playersToSubmit = Object.entries(lineup).map(([position, player]) => {
        // Convert F1/F2 to F, G1/G2 to G, keep C as C
        const dbPosition = position === 'C' ? 'C' : position.startsWith('F') ? 'F' : 'G';
        return {
          playerId: player.id,
          position: dbPosition,
        };
      });

      const result = await submitLineup(playersToSubmit);

      if (result.success) {
        setIsSubmitted(true);
      } else {
        setSubmitError(result.error || 'Failed to submit lineup');
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(optimisticLineup).length;
  const canSubmit = selectedCount === 5 && !isSubmitted && !isSubmitting;

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

      {/* Submitted Notice */}
      {isSubmitted && (
        <section className="px-4 pt-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm text-green-400 text-center">
              ✅ Lineup submitted successfully! You cannot modify it anymore.
            </p>
            {initialLineup && (
              <p className="text-xs text-green-400/70 text-center mt-1">
                Submitted for: {new Date(initialLineup.gameDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Read-only Notice */}
      {isReadOnly && !isSubmitted && (
        <section className="px-4 pt-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
            <p className="text-sm text-yellow-400 text-center">
              🔒 View-only mode. <button onClick={() => router.push('/login?redirect=/lineup')} className="underline font-medium">Sign in</button> to save your lineup.
            </p>
          </div>
        </section>
      )}

      {/* Submit Error */}
      {submitError && (
        <section className="px-4 pt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400 text-center">
              ❌ {submitError}
            </p>
          </div>
        </section>
      )}

      {/* Player Selection Prompt */}
      <section className="mt-4 px-4">
        <h2 className="text-xl font-bold text-center text-white">
          {isSubmitted ? (
            <>Your <span className="text-green-400">Lineup</span> for Today</>
          ) : (
            <>
              Select <span className="text-brand-blue">5 Players</span> for Today
              {selectedCount > 0 && (
                <span className="ml-2 text-brand-text-dim">
                  ({selectedCount}/5)
                </span>
              )}
            </>
          )}
          {isPending && (
            <span className="ml-2 text-xs text-brand-text-dim animate-pulse">
              (saving...)
            </span>
          )}
        </h2>

        {/* Submit Button */}
        {!isSubmitted && !isReadOnly && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                px-8 py-3 rounded-lg font-semibold text-white transition-all
                ${canSubmit
                  ? 'bg-brand-blue hover:bg-brand-blue/80 active:scale-95'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
                }
                ${isSubmitting ? 'animate-pulse' : ''}
              `}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Lineup'}
            </button>
          </div>
        )}
      </section>

      {/* Player Search Section */}
      <PlayerSearchSection
        players={players}
        onAddPlayer={handleAddPlayer}
        selectedPlayerIds={selectedPlayerIds}
        disabled={isSubmitted}
        selectedPositionFilter={selectedFilterPosition}
        onPositionFilterChange={setSelectedFilterPosition}
      />
    </>
  );
}
