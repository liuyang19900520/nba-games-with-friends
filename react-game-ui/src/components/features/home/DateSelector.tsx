'use client';

import { useState, useEffect } from 'react';
import { useGameDate } from '@/hooks/useGameDate';

interface DateSelectorProps {
  onDateChange: (date: string) => void;
  isLoading?: boolean;
  initialDate?: string;
}

export function DateSelector({ onDateChange, isLoading = false, initialDate }: DateSelectorProps) {
  const { gameDate, setGameDate } = useGameDate();
  const [selectedDate, setSelectedDate] = useState(initialDate || gameDate);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    } else {
      setSelectedDate(gameDate);
    }
  }, [gameDate, initialDate]);

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setGameDate(newDate);
    if (typeof document !== 'undefined') {
      const expires = new Date();
      expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
      document.cookie = `nba-fantasy-game-date=${newDate};expires=${expires.toUTCString()};path=/`;
    }
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <label className="text-sm font-medium text-white whitespace-nowrap">Date:</label>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => handleDateChange(e.target.value)}
        min="2020-01-01"
        max={maxDateStr}
        disabled={isLoading}
        className="flex-1 px-3 py-2 bg-brand-dark border border-brand-card-border rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
