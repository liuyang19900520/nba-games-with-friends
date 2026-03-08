'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateSelector } from './DateSelector';
import { GameList } from './GameList';
import { PremiumPredictionCard } from './PremiumPredictionCard';
import { PredictionModal } from './PredictionModal';
import { PredictionStreamView } from './PredictionStreamView';
import { PredictionResultCard } from './PredictionResultCard';
import { LineupStreamView } from './LineupStreamView';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { fetchGamesByDate } from '@/app/home/actions';
import { usePredictionStream } from '@/hooks/usePredictionStream';
import { useLineupStream } from '@/hooks/useLineupStream';
import { getTomorrowTokyoDate } from '@/lib/utils/game-date';

interface HomePageClientProps {
  initialGames: any[];
  initialDate: string;
  userId: string | null;
  creditsRemaining: number;
}

/**
 * Home page client-side dashboard logic.
 * Handles date selection, game listing, and AI prediction streaming.
 */
export function HomePageClient({
  initialGames,
  initialDate,
  userId,
  creditsRemaining,
}: HomePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [games, setGames] = useState(initialGames);
  const [isLoading, setIsLoading] = useState(false);
  const [predictionMatchup, setPredictionMatchup] = useState<any>(null);
  const [credits, setCredits] = useState(creditsRemaining);

  // Matchup prediction streaming
  const { status, steps, result, error, startPrediction, reset } = usePredictionStream();

  // 1-Click Lineup streaming
  const lineupStream = useLineupStream();

  // Restore credit on error (backend refunds, so UI should match)
  useEffect(() => {
    if (status === 'error' || lineupStream.status === 'error') {
      setCredits(prev => prev + 1);
    }
  }, [status, lineupStream.status]);

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setIsLoading(true);
    try {
      const { games: newGames } = await fetchGamesByDate(date);
      setGames(newGames);
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [toast, setToast] = useState({ isVisible: false, message: '' });
  const showToast = (message: string) => setToast({ isVisible: true, message });
  const hideToast = () => setToast({ isVisible: false, message: '' });

  // 1-Click Lineup handlers
  const handleLineupClick = () => {
    // Check if user has enough credits
    if (credits <= 0) {
      showToast('Insufficient AI credits. Please recharge.');
      return;
    }

    // If prediction is running, close it
    if (status !== 'idle') {
      reset();
      setPredictionMatchup(null);
    }

    // Deduct credit optimistically
    setCredits(prev => Math.max(0, prev - 1));

    // Always use tomorrow's date for AI feature logic
    lineupStream.startGeneration(getTomorrowTokyoDate());
  };

  const handleLineupComplete = useCallback(() => {
    // We give the user 2 seconds to see the results inline before navigating
    const timer = setTimeout(() => {
      const playerIds = lineupStream.players.map(p => p.player_id).join(',');
      router.push(`/lineup?ai_players=${playerIds}`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [lineupStream.players, router]);

  const handleLineupClose = () => {
    lineupStream.reset();
  };

  // Auto-navigate when lineup is complete
  useEffect(() => {
    if (lineupStream.status === 'complete' && lineupStream.players.length > 0) {
      const cleanup = handleLineupComplete();
      return cleanup;
    }
  }, [lineupStream.status, lineupStream.players, handleLineupComplete]);

  const handleMatchupClick = (matchup: any) => {
    // Check if user has enough credits
    if (credits <= 0) {
      showToast('Insufficient AI credits. Please recharge.');
      return;
    }

    setPredictionMatchup(matchup);
    // If lineup is running, close it
    if (lineupStream.status !== 'idle') {
      handleLineupClose();
    }

    // Deduct credit optimistically
    setCredits(prev => Math.max(0, prev - 1));

    // Use tomorrow's date for AI matchup prediction as well
    startPrediction(matchup, getTomorrowTokyoDate());
  };

  const handleClosePrediction = () => {
    reset();
    setPredictionMatchup(null);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Date Selector */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-brand-text-dim uppercase tracking-wider">
            Date:
          </label>
        </div>
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
        />
      </section>

      {/* AI Credits Info & Call to Action */}
      <section>
        <PremiumPredictionCard
          onPredictionClick={() => { }} // Managed via individual match clicks
          onLineupClick={handleLineupClick}
          userCredits={credits}
          isStreaming={status === 'streaming' || lineupStream.status === 'streaming'}
        />
      </section>

      {/* AI Thinking Process (streaming Matchup) */}
      {(status === 'streaming' || status === 'error') && (
        <section>
          <PredictionStreamView
            status={status}
            steps={steps}
            error={error}
            onClose={handleClosePrediction}
          />
        </section>
      )}

      {/* AI Thinking Process (streaming Lineup) */}
      {(lineupStream.status !== 'idle') && (
        <section>
          <LineupStreamView
            status={lineupStream.status}
            steps={lineupStream.steps}
            players={lineupStream.players}
            error={lineupStream.error}
            onClose={handleLineupClose}
          />
        </section>
      )}

      {/* Final Prediction Result */}
      {status === 'complete' && result && predictionMatchup && (
        <section>
          <PredictionResultCard
            matchup={predictionMatchup}
            result={result}
            onClose={handleClosePrediction}
          />
        </section>
      )}

      {/* Games List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Recent Games</h2>
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-blue animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 rounded-full bg-brand-blue animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 rounded-full bg-brand-blue animate-bounce"></div>
            </div>
          )}
        </div>
        <GameList
          games={games}
          isLoading={isLoading}
          onPredictClick={handleMatchupClick}
        />
      </section>

      {/* Prediction Flow (for match buttons) */}
      <PredictionModal
        isOpen={false} // Managed via inline view
        onClose={() => { }}
        matchup={null}
        onConfirm={() => { }}
        isSubmitting={false}
      />

      {/* Notification Toast */}
      <NotificationToast
        isVisible={toast.isVisible}
        message={toast.message}
        onClose={hideToast}
      />
    </div>
  );
}
