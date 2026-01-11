'use client';

import { useState, useTransition } from 'react';
import { DateSelector } from './DateSelector';
import { GameResultsList } from './GameResultsList';
import { PremiumFeatureCard } from './PremiumFeatureCard';
import { fetchGamesByDate } from '@/app/home/actions';
import type { GameResult } from '@/types';

interface HomePageClientProps {
  initialGames: GameResult[];
  initialDate: string;
}

export function HomePageClient({ initialGames, initialDate }: HomePageClientProps) {
  const [games, setGames] = useState<GameResult[]>(initialGames);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isPending, startTransition] = useTransition();

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    
    startTransition(async () => {
      try {
        const newGames = await fetchGamesByDate(date);
        setGames(newGames);
      } catch (error) {
        console.error('[HomePageClient] Error fetching games:', error);
        // Keep existing games on error
      }
    });
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

      {/* Premium Feature Section */}
      <section>
        <PremiumFeatureCard />
      </section>
    </div>
  );
}
