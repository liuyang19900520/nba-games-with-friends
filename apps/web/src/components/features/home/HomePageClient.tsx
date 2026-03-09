'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DateSelector } from './DateSelector';
import { GameResultsList } from './GameResultsList';
import { PremiumPredictionCard } from './PremiumPredictionCard';
import { PremiumFeatureCard } from './PremiumFeatureCard';
import { PredictionModal } from './PredictionModal';
import { PredictionStreamView } from './PredictionStreamView';
import { PredictionResultCard } from './PredictionResultCard';
import { LineupStreamView } from './LineupStreamView';
import { fetchGamesByDate } from '@/app/home/actions';
import { usePredictionStream } from '@/hooks/usePredictionStream';
import { useLineupStream } from '@/hooks/useLineupStream';
import { getTomorrowTokyoDate, getTokyoDate } from '@/lib/utils/game-date';
import type { GameResult } from '@/types';

interface HomePageClientProps {
  initialGames: GameResult[];
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
  userId: _userId,
  creditsRemaining,
}: HomePageClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [games, setGames] = useState<GameResult[]>(initialGames);
  const [isLoading, setIsLoading] = useState(false);
  const [predictionMatchup, setPredictionMatchup] = useState<GameResult | null>(null);
  const [credits, setCredits] = useState(creditsRemaining);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Matchup prediction streaming
  const { status, steps, result, error, startPrediction, reset } = usePredictionStream();

  // 1-Click Lineup streaming
  const lineupStream = useLineupStream();

  // Target date for AI features: if showing today and all games are finished, suggest tomorrow.
  const aiTargetDate = useMemo(() => {
    const today = getTokyoDate();
    // Only apply 'shift to tomorrow' logic when viewing actual today
    if (selectedDate !== today) return selectedDate;

    const allGamesFinal = games.length > 0 && games.every(g => g.status === 'Final');
    return allGamesFinal ? getTomorrowTokyoDate() : today;
  }, [selectedDate, games]);

  // Games to show in the prediction selection modal (matching aiTargetDate)
  const [predictedGames, setPredictedGames] = useState<GameResult[]>([]);

  useEffect(() => {
    if (aiTargetDate === selectedDate) {
      setPredictedGames(games);
    } else {
      const loadPredictedGames = async () => {
        try {
          const fetched = await fetchGamesByDate(aiTargetDate);
          setPredictedGames(fetched);
        } catch (err) {
          console.error('Failed to fetch AI target games:', err);
        }
      };
      loadPredictedGames();
    }
  }, [aiTargetDate, selectedDate, games]);

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
      const newGames = await fetchGamesByDate(date);
      setGames(newGames);
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setIsLoading(false);
    }
  };



  // 1-Click Lineup handlers
  const handleLineupClick = () => {
    if (credits <= 0) {
      router.push('/payment');
      return;
    }

    if (status !== 'idle') {
      reset();
      setPredictionMatchup(null);
    }

    setCredits(prev => Math.max(0, prev - 1));
    lineupStream.startGeneration(aiTargetDate);
  };

  const handleLineupComplete = useCallback(() => {
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

  const handleMatchupClick = (matchup: GameResult) => {
    if (credits <= 0) {
      router.push('/payment');
      return;
    }

    setPredictionMatchup(matchup);
    setIsModalOpen(false);

    if (lineupStream.status !== 'idle') {
      handleLineupClose();
    }

    setCredits(prev => Math.max(0, prev - 1));

    // Correct 3 arguments for startPrediction
    startPrediction(matchup.homeTeam.name, matchup.awayTeam.name, aiTargetDate);
  };

  const handleClosePrediction = () => {
    reset();
    setPredictionMatchup(null);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Date Selector */}
      <section>
        <DateSelector
          initialDate={selectedDate}
          onDateChange={handleDateChange}
          isLoading={isLoading}
        />
      </section>

      {/* AI Credits Info & Call to Action or Recharge Card */}
      <section>
        {credits > 0 ? (
          <PremiumPredictionCard
            onPredictClick={() => setIsModalOpen(true)}
            onLineupClick={handleLineupClick}
            creditsRemaining={credits}
          />
        ) : (
          <PremiumFeatureCard userId={_userId} />
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
            homeTeam={predictionMatchup.homeTeam.name}
            awayTeam={predictionMatchup.awayTeam.name}
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
        <GameResultsList
          games={games}
          onPredictClick={handleMatchupClick}
        />
      </section>

      {/* Selection Modal (when clicking Predict Results from Hub) */}
      <PredictionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        games={predictedGames}
        onSelectGame={handleMatchupClick}
        isSubmitting={status === 'streaming'}
      />


    </div>
  );
}
