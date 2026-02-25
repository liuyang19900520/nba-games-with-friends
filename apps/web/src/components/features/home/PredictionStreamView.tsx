'use client';

import { useEffect, useRef } from 'react';
import { Brain, Sparkles, X } from 'lucide-react';
import type { PredictionStep } from '@/app/home/actions';
import type { PredictionStatus } from '@/hooks/usePredictionStream';

interface PredictionStreamViewProps {
    status: PredictionStatus;
    steps: PredictionStep[];
    error: string | null;
    onClose: () => void;
}

/**
 * Displays the real-time AI thinking process as a vertical timeline.
 * Each step animates in as it arrives via SSE.
 */
export function PredictionStreamView({ status, steps, error, onClose }: PredictionStreamViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom as new steps arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [steps]);

    if (status === 'idle') return null;

    const phaseColors: Record<string, string> = {
        planning: 'border-yellow-400/50 bg-yellow-400/5',
        executing: 'border-blue-400/50 bg-blue-400/5',
        replanning: 'border-purple-400/50 bg-purple-400/5',
        concluding: 'border-green-400/50 bg-green-400/5',
        complete: 'border-brand-blue/50 bg-brand-blue/5',
    };

    const phaseDot: Record<string, string> = {
        planning: 'bg-yellow-400',
        executing: 'bg-blue-400',
        replanning: 'bg-purple-400',
        concluding: 'bg-green-400',
        complete: 'bg-brand-blue',
    };

    return (
        <div className="relative rounded-xl border border-brand-blue/30 bg-black/70 backdrop-blur-sm overflow-hidden shadow-glow-blue animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-brand-blue/20 bg-gradient-to-r from-brand-blue/10 to-transparent">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-brand-blue" />
                    <h3 className="text-base font-bold text-white">AI Agent Thinking...</h3>
                    {status === 'streaming' && (
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue" />
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-white/10 text-brand-text-dim hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Steps Timeline */}
            <div ref={scrollRef} className="p-4 max-h-[50vh] overflow-y-auto">
                <div className="space-y-3">
                    {steps.map((step, idx) => {
                        const isLatest = idx === steps.length - 1 && status === 'streaming';
                        return (
                            <div
                                key={`${step.step}-${idx}`}
                                className={`flex gap-3 animate-in slide-in-from-left-2 duration-300`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Timeline dot + line */}
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${phaseDot[step.phase] || 'bg-gray-400'
                                            } ${isLatest ? 'animate-pulse' : ''}`}
                                    />
                                    {idx < steps.length - 1 && (
                                        <div className="w-px flex-1 bg-white/10 mt-1" />
                                    )}
                                </div>

                                {/* Step content */}
                                <div
                                    className={`flex-1 rounded-lg border p-3 ${phaseColors[step.phase] || 'border-white/10 bg-white/5'
                                        } ${isLatest ? 'ring-1 ring-brand-blue/30' : ''}`}
                                >
                                    <p className="text-sm font-medium text-white">{step.title}</p>
                                    {step.detail && (
                                        <div className="mt-1.5 text-xs text-brand-text-dim leading-relaxed">
                                            {Array.isArray(step.detail) ? (
                                                <ol className="list-decimal list-inside space-y-0.5">
                                                    {step.detail.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ol>
                                            ) : (
                                                <p className="line-clamp-3">{step.detail}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Streaming indicator */}
                    {status === 'streaming' && steps.length > 0 && (
                        <div className="flex items-center gap-2 pl-5 pt-1">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-brand-text-dim">Processing...</span>
                        </div>
                    )}

                    {/* Initial loading (no steps yet) */}
                    {status === 'streaming' && steps.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-brand-text-dim animate-pulse">
                                Initializing AI Agent...
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {status === 'error' && error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-400/30 bg-red-400/5">
                            <span className="text-red-400 text-sm shrink-0">⚠️</span>
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            {status === 'streaming' && (
                <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-brand-blue/50" />
                        <p className="text-[11px] text-brand-text-dim">
                            AI is analyzing multiple data sources — this may take 30-60 seconds
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
