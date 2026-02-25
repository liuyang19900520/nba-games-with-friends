'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTokyoDate, formatTokyoDate } from '@/lib/utils/timezone';

interface DateSelectProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Unified Date Select Component
 * A styled dropdown date picker with consistent design across the app
 */
export function DateSelect({
  value,
  onChange,
  min = '2020-01-01',
  max,
  disabled = false,
  className,
  placeholder = 'Select date',
}: DateSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Format date for display (Tokyo timezone)
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '';
    return formatTokyoDate(dateStr, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    setDisplayValue(formatDisplayDate(value));
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDateChange = (newDate: string) => {
    onChange(newDate);
    setIsOpen(false);
  };

  // Generate date options (last 30 days + next 30 days) in Tokyo timezone
  const generateDateOptions = () => {
    const options: string[] = [];
    const today = getTokyoDate();
    const todayDate = new Date(today + 'T00:00:00+09:00');
    const maxDate = max ? new Date(max + 'T00:00:00+09:00') : new Date(todayDate.getFullYear() + 1, todayDate.getMonth(), todayDate.getDate());
    const minDate = new Date(min + 'T00:00:00+09:00');

    // Add "Today" option
    options.push(today);

    // Add past 30 days
    for (let i = 1; i <= 30; i++) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      if (date >= minDate) {
        options.push(dateStr);
      }
    }

    // Add next 30 days
    for (let i = 1; i <= 30; i++) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      if (date <= maxDate) {
        options.push(dateStr);
      }
    }

    return options.sort().reverse(); // Most recent first
  };

  const dateOptions = generateDateOptions();

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2',
          'bg-brand-dark border border-brand-card-border rounded-lg',
          'text-white text-sm',
          'focus:outline-none focus:border-brand-blue',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'hover:border-brand-card-border-active transition-colors',
          isOpen && 'border-brand-blue'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-brand-text-dim flex-shrink-0" />
          <span className={cn('truncate', !value && 'text-brand-text-dim')}>
            {displayValue || placeholder}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-brand-text-dim flex-shrink-0 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-brand-card border border-brand-card-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* Native date input for better UX */}
          <div className="p-2 border-b border-brand-card-border">
            <input
              type="date"
              value={value}
              onChange={(e) => handleDateChange(e.target.value)}
              min={min}
              max={max}
              className="w-full px-3 py-2 bg-brand-dark border border-brand-card-border rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue"
            />
          </div>

          {/* Quick date options */}
          <div className="p-1">
            {dateOptions.map((dateStr) => {
              const isSelected = dateStr === value;
              const isToday = dateStr === getTokyoDate();
              
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDateChange(dateStr)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    isSelected
                      ? 'bg-brand-blue/20 text-brand-blue font-medium'
                      : 'text-white hover:bg-brand-dark',
                    isToday && !isSelected && 'text-brand-orange'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{formatDisplayDate(dateStr)}</span>
                    {isToday && (
                      <span className="text-xs text-brand-text-dim">Today</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
