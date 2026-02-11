'use client';

import { useState, useTransition } from 'react';
import { DateSelector } from './DateSelector';
import { GameResultsList } from './GameResultsList';
import { PremiumFeatureCard } from './PremiumFeatureCard';
import { PremiumPredictionCard } from './PremiumPredictionCard';
import { PredictionModal } from './PredictionModal';
import { PredictionStreamView } from './PredictionStreamView';
import { PredictionResultCard } from './PredictionResultCard';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { fetchGamesByDate } from '@/app/home/actions';
import { usePredictionStream } from '@/hooks/usePredictionStream';
import type { GameResult } from '@/types';

interface HomePageClientProps {
  initialGames: GameResult[];
  initialDate: string;
  userId: string | null;
  isPremium: boolean;
}

export function HomePageClient({ initialGames, initialDate, userId, isPremium }: HomePageClientProps) {
  const [games, setGames] = useState<GameResult[]>(initialGames);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isPending, startTransition] = useTransition();

  // Prediction Modal State
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);

  // Streaming prediction
  const { status, steps, result, error, startPrediction, reset } = usePredictionStream();

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
        console.error('[HomePageClient] Error fetching games:', error);
      }
    });
  };

  const handlePredictClick = () => {
    setIsPredictionModalOpen(true);
  };

  const handleGameSelect = (game: GameResult) => {
    setIsPredictionModalOpen(false);
    setPredictionMatchup({ home: game.homeTeam.name, away: game.awayTeam.name });
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

      {/* Premium Section */}
      <section>
        {isPremium ? (
          <PremiumPredictionCard onPredictClick={handlePredictClick} />
        ) : (
          <PremiumFeatureCard userId={userId} />
        )}
      </section>

      {/* AI Thinking Process (streaming) */}
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
