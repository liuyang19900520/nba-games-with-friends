'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { DateSelector } from './DateSelector';
import { GameResultsList } from './GameResultsList';
import { PremiumPredictionCard } from './PremiumPredictionCard';
import { PremiumFeatureCard } from './PremiumFeatureCard';
import { PredictionModal } from './PredictionModal';
import { PredictionStreamView } from './PredictionStreamView';
import { PredictionResultCard } from './PredictionResultCard';
import { LineupStreamView } from './LineupStreamView';
import { fetchGamesByDate } from '@/app/home/actions';
import { getCreditsRemaining } from '@/app/payment/actions';
import { usePredictionStream } from '@/hooks/usePredictionStream';
import { useLineupStream } from '@/hooks/useLineupStream';
import type { GameResult } from '@/types';

interface Props {
  initialGames: GameResult[];
  initialDate: string;
  userId: string | null;
  creditsRemaining: number;
  aiMode: 'demo' | 'llm';
}

export function HomePageClient({ initialGames, initialDate, userId, creditsRemaining, aiMode }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [games, setGames] = useState(initialGames);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [credits, setCredits] = useState(creditsRemaining);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [matchup, setMatchup] = useState<GameResult | null>(null);
  const loadVersion = useRef(0);
  const prediction = usePredictionStream();
  const lineup = useLineupStream();
  const busy = prediction.status === 'streaming' || lineup.status === 'streaming';
  const busyRef = useRef(false);

  useEffect(() => { setCredits(creditsRemaining); }, [creditsRemaining]);
  useEffect(() => {
    busyRef.current = busy;
    if (['complete', 'error'].includes(prediction.status) || ['complete', 'error'].includes(lineup.status)) {
      let active = true;
      void getCreditsRemaining().then(value => { if (active) setCredits(value); });
      return () => { active = false; };
    }
  }, [prediction.status, lineup.status, busy]);

  const loadDate = async (date: string) => {
    const version = ++loadVersion.current;
    setSelectedDate(date);
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextGames = await fetchGamesByDate(date);
      if (version === loadVersion.current) setGames(nextGames);
    } catch {
      if (version === loadVersion.current) {
        setGames([]);
        setLoadError('Could not reload games. Please try again.');
      }
    } finally { if (version === loadVersion.current) setIsLoading(false); }
  };
  const canStart = () => {
    if (busyRef.current || isLoading) return false;
    if (!userId) { router.push('/login?redirect=/home'); return false; }
    if (credits <= 0) { router.push('/payment'); return false; }
    busyRef.current = true;
    return true;
  };
  const generateLineup = () => {
    if (!canStart()) return;
    prediction.reset(); setMatchup(null);
    lineup.startGeneration(selectedDate);
  };
  const predict = (game: GameResult) => {
    if (!canStart()) return;
    lineup.reset(); setMatchup(game); setIsModalOpen(false);
    prediction.startPrediction(game.homeTeam.name, game.awayTeam.name, selectedDate);
  };
  const closePrediction = () => { prediction.reset(); setMatchup(null); busyRef.current = false; };
  const usePlayers = () => {
    const params = new URLSearchParams({ ai_players: lineup.players.map(p => p.player_id).join(','), date: lineup.gameDate || selectedDate });
    router.push('/lineup?' + params);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <DateSelector initialDate={selectedDate} onDateChange={loadDate} isLoading={isLoading || busy} />
      <section aria-label="Basketball assistant" className="space-y-3">
        <p className="text-xs text-brand-text-dim">
          {aiMode === 'demo' ? 'Data demo · no model calls. Uses the statistics already stored for your selected date.' : 'AI analysis · uses stored statistics. Missing injury and news data are disclosed in the result.'}
        </p>
        {credits > 0 ? (
          <PremiumPredictionCard onPredictClick={() => setIsModalOpen(true)} onLineupClick={generateLineup} creditsRemaining={credits} disabled={busy || isLoading} />
        ) : <PremiumFeatureCard userId={userId} />}
      </section>
      {(prediction.status === 'streaming' || prediction.status === 'error') && (
        <PredictionStreamView status={prediction.status} steps={prediction.steps} error={prediction.error} onClose={closePrediction} />
      )}
      {prediction.status === 'complete' && prediction.result && matchup && (
        <PredictionResultCard result={prediction.result} homeTeam={matchup.homeTeam.name} awayTeam={matchup.awayTeam.name} onClose={closePrediction} />
      )}
      {lineup.status !== 'idle' && (
        <section className="space-y-3">
          <LineupStreamView status={lineup.status} steps={lineup.steps} players={lineup.players} error={lineup.error} onClose={lineup.reset} />
          {lineup.status === 'complete' && (
            <div className="rounded-xl border border-brand-card-border bg-brand-dark p-4 space-y-3">
              <p className="text-xs text-brand-blue">{lineup.mode === 'demo' ? 'Data demo' : 'AI explanation'} · {lineup.gameDate}</p>
              <p className="text-sm text-brand-text-dim">{lineup.explanation}</p>
              <button onClick={usePlayers} className="w-full rounded-lg bg-brand-blue py-3 text-brand-dark">Review these five players</button>
            </div>
          )}
        </section>
      )}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Games</h2>
          <button onClick={() => loadDate(selectedDate)} disabled={isLoading || busy} className="flex items-center gap-2 text-sm text-brand-blue disabled:opacity-50">
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Reload data
          </button>
        </div>
        <p className="mb-3 text-xs text-brand-text-dim">Reloads stored data. NBA source updates are managed separately.</p>
        {loadError && <p role="alert" className="mb-3 text-sm text-red-400">{loadError}</p>}
        <GameResultsList games={games} onPredictClick={predict} />
      </section>
      <PredictionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} games={games} onSelectGame={predict} isSubmitting={busy || isLoading} />
    </div>
  );
}
