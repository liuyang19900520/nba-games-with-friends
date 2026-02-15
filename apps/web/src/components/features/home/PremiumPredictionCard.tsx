'use client';

import { Shirt, Sparkles } from 'lucide-react';

interface PremiumPredictionCardProps {
  onPredictClick?: () => void;
  creditsRemaining: number;
}

/**
 * Premium Prediction Card (AI Feature Hub)
 * Displays AI features for users with credits: 1-Click Lineup, Predict Results, AI Chat Mode.
 */
export function PremiumPredictionCard({ onPredictClick, creditsRemaining }: PremiumPredictionCardProps) {
  return (
    <div className="relative rounded-xl border border-brand-blue/30 bg-black/40 p-6 shadow-glow-blue overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 to-transparent pointer-events-none" />

      {/* Header with credits badge */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-brand-blue drop-shadow-[0_0_8px_rgba(110,226,245,0.8)]">
          AI Feature Hub
        </h2>
        <span className="px-3 py-1 rounded-full bg-brand-blue/20 border border-brand-blue/40 text-brand-blue text-sm font-medium">
          {creditsRemaining} credits
        </span>
      </div>

      {/* Buttons Container */}
      <div className="relative z-10 space-y-4">

        {/* Button 1: 1-Click Lineup */}
        <button
          className="w-full group relative flex items-center justify-between p-4 rounded-xl border border-brand-blue/40 bg-brand-dark/60 hover:bg-brand-blue/10 hover:border-brand-blue transition-all duration-300 shadow-[0_0_15px_rgba(110,226,245,0.15)]"
          onClick={() => console.log('1-Click Lineup clicked')}
        >
          <div className="text-left">
            <div className="text-xl font-medium text-brand-text-light group-hover:text-brand-blue transition-colors drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              1-Click Lineup
            </div>
            <div className="text-xs text-brand-text-dim mt-1 group-hover:text-brand-text-light/80 transition-colors">
              Optimized by Neural Engine
            </div>
          </div>
          <Shirt
            strokeWidth={1.5}
            className="w-8 h-8 text-brand-orange drop-shadow-[0_0_8px_rgba(245,166,35,0.8)]"
          />
        </button>

        {/* Button 2: Predict Results */}
        <button
          className="w-full group relative flex items-center justify-between p-4 rounded-xl border border-brand-blue/40 bg-brand-dark/60 hover:bg-brand-blue/10 hover:border-brand-blue transition-all duration-300 shadow-[0_0_15px_rgba(110,226,245,0.15)]"
          onClick={onPredictClick}
        >
          <div className="text-left">
            <div className="text-xl font-medium text-brand-text-light group-hover:text-brand-blue transition-colors drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              Predict Results
            </div>
            <div className="text-xs text-brand-text-dim mt-1 group-hover:text-brand-text-light/80 transition-colors">
              Real-time Probabilities
            </div>
          </div>
          <Sparkles
            strokeWidth={1.5}
            className="w-8 h-8 text-brand-blue drop-shadow-[0_0_8px_rgba(110,226,245,0.8)]"
          />
        </button>


      </div>
    </div>
  );
}
