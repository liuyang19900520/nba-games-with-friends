'use client';

import { X, Trophy, TrendingUp, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export interface PredictionResult {
    winner: string;
    confidence: number;
    key_factors: string[];
    detailed_analysis: string;
}

interface PredictionResultCardProps {
    result: PredictionResult;
    homeTeam: string;
    awayTeam: string;
    onClose: () => void;
}

export function PredictionResultCard({ result, homeTeam, awayTeam, onClose }: PredictionResultCardProps) {
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
    const confidencePercent = Math.round(result.confidence * 100);

    // Determine confidence color
    const getConfidenceColor = (pct: number) => {
        if (pct >= 75) return 'text-green-400';
        if (pct >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getConfidenceBarColor = (pct: number) => {
        if (pct >= 75) return 'bg-green-400';
        if (pct >= 50) return 'bg-yellow-400';
        return 'bg-red-400';
    };

    return (
        <div className="relative rounded-xl border border-brand-blue/30 bg-black/60 backdrop-blur-sm overflow-hidden shadow-glow-blue animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-brand-blue/20 bg-gradient-to-r from-brand-blue/10 to-transparent">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-blue" />
                    <h3 className="text-lg font-bold text-white">AI Prediction</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-white/10 text-brand-text-dim hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Matchup Header */}
            <div className="px-4 pt-4 text-center">
                <p className="text-sm text-brand-text-dim">
                    {awayTeam} <span className="text-brand-blue font-bold mx-2">VS</span> {homeTeam}
                </p>
            </div>

            {/* Winner */}
            <div className="px-4 pt-3 pb-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue/10 border border-brand-blue/30">
                    <Trophy className="w-5 h-5 text-brand-blue" />
                    <span className="text-xl font-bold text-white">{result.winner}</span>
                </div>
            </div>

            {/* Confidence */}
            <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-brand-text-dim" />
                        <span className="text-sm text-brand-text-dim">Confidence</span>
                    </div>
                    <span className={`text-lg font-bold ${getConfidenceColor(confidencePercent)}`}>
                        {confidencePercent}%
                    </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${getConfidenceBarColor(confidencePercent)}`}
                        style={{ width: `${confidencePercent}%` }}
                    />
                </div>
            </div>

            {/* Key Factors */}
            <div className="px-4 pb-4">
                <h4 className="text-sm font-semibold text-brand-text-light mb-2">Key Factors</h4>
                <ul className="space-y-1.5">
                    {result.key_factors.map((factor, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-brand-text-dim">
                            <span className="text-brand-blue mt-0.5 shrink-0">•</span>
                            <span>{factor}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Detailed Analysis (Collapsible) */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className="flex items-center justify-between w-full text-sm font-semibold text-brand-text-light hover:text-white transition-colors"
                >
                    <span>Detailed Analysis</span>
                    {isAnalysisExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </button>
                {isAnalysisExpanded && (
                    <div className="mt-2 p-3 rounded-lg bg-white/5 text-sm text-brand-text-dim leading-relaxed whitespace-pre-wrap">
                        {result.detailed_analysis}
                    </div>
                )}
            </div>
        </div>
    );
}
