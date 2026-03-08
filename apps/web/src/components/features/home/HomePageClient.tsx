'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DateSelector } from './DateSelector';
import { GameResultsList } from './GameResultsList';
import { PremiumFeatureCard } from './PremiumFeatureCard';
import { PremiumPredictionCard } from './PremiumPredictionCard';
import { PredictionModal } from './PredictionModal';
import { PredictionStreamView } from './PredictionStreamView';
import { PredictionResultCard } from './PredictionResultCard';
import { LineupStreamView } from './LineupStreamView';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { fetchGamesByDate } from '@/app/home/actions';
import { usePredictionStream } from '@/hooks/usePredictionStream';
import { useLineupStream } from '@/hooks/useLineupStream';
import type { GameResult } from '@/types';

interface HomePageClientProps {
  initialGames: GameResult[];
  initialDate: string;
  userId: string | null;
  creditsRemaining: number;
}

export function HomePageClient({ initialGames, initialDate, userId, creditsRemaining: initialCredits }: HomePageClientProps) {
  const [games, setGames] = useState<GameResult[]>(initialGames);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [credits, setCredits] = useState(initialCredits);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasProcessedPayment = useRef(false);

  // Handle payment success callback
  useEffect(() => {
    const paymentStatus = searchParams?.get('payment');
    if (paymentStatus === 'success' && !hasProcessedPayment.current) {
      hasProcessedPayment.current = true;
      // Optimistically assume 5 credits were added in case webhook is delayed
      if (credits === 0) {
        setCredits(5);
      }

      // Clean up the URL securely with Next.js router
      router.replace('/home');

      setToast({
        isVisible: true,
        message: 'Payment verified! You can now use AI Predictions.'
      });
    }
  }, [searchParams, credits, router]);

  // Prediction Modal State
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);

  // Streaming prediction
  const { status, steps, result, error, startPrediction, reset } = usePredictionStream();

  // 1-Click Lineup streaming
  const lineupStream = useLineupStream();

  // Restore credit on error (backend refunds, so UI should match)
  useEffect(() => {
    if (status === 'error') {
      setCredits(prev => prev + 1);
    }
  }, [status]);

  // Matchup info for result display
  const [predictionMatchup, setPredictionMatchup] = useState<{ home: string; away: string } | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ isVisible: boolean; message: string }>({
    isVisible: false,
    message: ''
  });

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);

    startTransition(async () => {
      try {
        const newGames = await fetchGamesByDate(date);
        setGames(newGames);
      } catch (error) {
        setToast({
          isVisible: true,
          message: 'Failed to fetch games'
        });
        // We throw so it can be handled globally instead of silently swallowed
        throw error;
      }
    });
  };

  const handlePredictClick = () => {
    setIsPredictionModalOpen(true);
  };

  const handleGameSelect = (game: GameResult) => {
    setIsPredictionModalOpen(false);
    setPredictionMatchup({ home: game.homeTeam.name, away: game.awayTeam.name });
    // Optimistically decrement credit in UI
    setCredits(prev => Math.max(0, prev - 1));
    startPrediction(
      game.homeTeam.name,
      game.awayTeam.name,
      game.gameDate || selectedDate
    );
  };

  const handleClosePrediction = () => {
    reset();
    setPredictionMatchup(null);
  };

  // 1-Click Lineup handlers
  const handleLineupClick = () => {
    // If prediction is running, close it
    if (status !== 'idle') {
      reset();
      setPredictionMatchup(null);
    }
    lineupStream.startGeneration(selectedDate);
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

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Date Selector */}
      <DateSelector
        onDateChange={handleDateChange}
        isLoading={isPending}
        initialDate={initialDate}
      />

      {/* Games Section */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Games
        </h2>
        {isPending ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-text-dim mt-2">Loading games...</p>
          </div>
        ) : (
          <GameResultsList games={games} />
        )}
      </section>

      {/* AI Credits Section */}
      <section>
        {credits > 0 ? (
          <PremiumPredictionCard
            onPredictClick={handlePredictClick}
            onLineupClick={handleLineupClick}
            creditsRemaining={credits}
          />
        ) : (
          <PremiumFeatureCard userId={userId} />
        )}
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
            result={result}
            homeTeam={predictionMatchup.home}
            awayTeam={predictionMatchup.away}
            onClose={handleClosePrediction}
          />
        </section>
      )}

      {/* Prediction Modal */}
      <PredictionModal
        isOpen={isPredictionModalOpen}
        onClose={() => setIsPredictionModalOpen(false)}
        games={games}
        onSelectGame={handleGameSelect}
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
