'use client';

import { useState, useEffect } from 'react';
import { useGameDate } from '@/hooks/useGameDate';
import { DateSelect } from '@/components/ui/date-select';
import { getTokyoDate } from '@/lib/utils/timezone';

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

  // Calculate max date (1 year from today in Tokyo timezone)
  const today = getTokyoDate();
  const todayDate = new Date(today + 'T00:00:00+09:00');
  const maxDate = new Date(todayDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;

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
      <DateSelect
        value={selectedDate}
        onChange={handleDateChange}
        min="2020-01-01"
        max={maxDateStr}
        disabled={isLoading}
        className="flex-1"
        placeholder="Select date"
      />
    </div>
  );
}
