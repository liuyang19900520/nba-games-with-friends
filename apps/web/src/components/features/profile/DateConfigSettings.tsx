'use client';

import { useState } from 'react';
import { Calendar, X, RotateCcw } from 'lucide-react';
import { useGameDate } from '@/hooks/useGameDate';
import { getTokyoDate, formatTokyoDate } from '@/lib/utils/timezone';
import { DateSelect } from '@/components/ui/date-select';

interface DateConfigSettingsProps {
  onClose: () => void;
}

export function DateConfigSettings({ onClose }: DateConfigSettingsProps) {
  const { gameDate, setGameDate, resetToToday, isCustomDate } = useGameDate();
  const [tempDate, setTempDate] = useState(gameDate);
  const [hasChanges, setHasChanges] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const handleDateChange = (newDate: string) => {
    setTempDate(newDate);
    setHasChanges(newDate !== gameDate);
  };

  const handleSave = async () => {
    setGameDate(tempDate);
    setHasChanges(false);
    
    // Also set cookie for server-side access
    if (typeof document !== 'undefined') {
      const expires = new Date();
      expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
      document.cookie = `nba-fantasy-game-date=${tempDate};expires=${expires.toUTCString()};path=/`;
    }
    
    // Refresh the page to refetch data with new date
    window.location.reload();
  };

  const handleReset = () => {
    setTempDate(today);
    setHasChanges(today !== gameDate);
  };

  const formatDate = (dateStr: string) => {
    return formatTokyoDate(dateStr, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-brand-card border border-brand-card-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-card-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-blue" />
            <h2 className="text-lg font-semibold text-white">Game Date Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-brand-dark rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-brand-text-dim" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Date Display */}
          <div className="bg-brand-dark/50 rounded-lg p-4">
            <p className="text-xs text-brand-text-dim mb-1">Current Game Date</p>
            <p className="text-lg font-semibold text-white">
              {formatDate(gameDate)}
            </p>
            {isCustomDate && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ Using custom date (not today)
              </p>
            )}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Select Game Date
            </label>
            <DateSelect
              value={tempDate}
              onChange={handleDateChange}
              min="2020-01-01"
              max={maxDateStr}
              placeholder="Select game date"
            />
            <p className="text-xs text-brand-text-dim">
              This date will be used for fetching lineup data and game information
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-dark border border-brand-card-border rounded-lg text-white hover:bg-brand-dark/80 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Today
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              💡 This setting is stored locally in your browser. It affects data fetching for lineup selection and game information.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-brand-card-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-brand-dark border border-brand-card-border rounded-lg text-white hover:bg-brand-dark/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 px-4 py-2 bg-brand-blue rounded-lg text-white font-semibold hover:bg-brand-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
