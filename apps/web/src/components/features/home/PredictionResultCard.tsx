'use client';
import { X, Sparkles } from 'lucide-react';
import type { PredictionOutput } from '@/lib/ai/contracts';

export type PredictionResult = PredictionOutput;
export function PredictionResultCard({ result, homeTeam, awayTeam, onClose }: {
  result: PredictionResult; homeTeam: string; awayTeam: string; onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-brand-blue/30 bg-brand-dark p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><Sparkles className="h-5 w-5 text-brand-blue" />{result.mode === 'demo' ? 'Data demo' : 'AI matchup analysis'}</h3>
        <button onClick={onClose} aria-label="Close analysis" className="p-2 rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <p className="text-sm text-brand-text-dim">{awayTeam} vs {homeTeam}</p>
      <p className="text-lg font-semibold text-brand-blue">{result.winner}</p>
      <p className="text-xs text-brand-text-dim">Completed-game evidence through {result.data_as_of}. This analysis is not a calibrated win probability.</p>
      <ul className="list-disc pl-5 space-y-2 text-sm text-brand-text-dim">{result.key_factors.map((factor, i) => <li key={i}>{factor}</li>)}</ul>
      <p className="text-sm text-brand-text-light leading-relaxed">{result.detailed_analysis}</p>
    </div>
  );
}
