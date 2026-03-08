'use client';

import { useEffect, useRef } from 'react';
import { Zap, Sparkles, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { LineupStreamStatus, LineupProgressStep, LineupPlayer } from '@/hooks/useLineupStream';

interface LineupStreamViewProps {
    status: LineupStreamStatus;
    steps: LineupProgressStep[];
    players: LineupPlayer[];
    error: string | null;
    onClose: () => void;
}

/**
 * Inline view for 1-Click Lineup SSE progress.
 * Displays progress steps and player results inline in the component list.
 */
export function LineupStreamView({
    status,
    steps,
    players,
    error,
    onClose,
}: LineupStreamViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic if needed
    useEffect(() => {
        if (scrollRef.current && status === 'streaming') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [steps, status]);

    if (status === 'idle') return null;

    return (
        <div className="relative rounded-xl border border-brand-blue/30 bg-black/60 backdrop-blur-md overflow-hidden shadow-glow-blue animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-brand-blue/20 bg-gradient-to-r from-brand-blue/10 to-transparent">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-brand-blue" />
                    <h3 className="text-base font-bold text-white">Neural Fantasy Engine</h3>
                    {status === 'streaming' && (
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue" />
                        </span>
                    )}
                </div>
                {(status === 'error' || status === 'complete') && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-white/10 text-brand-text-dim hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Progress Steps */}
            <div ref={scrollRef} className="p-4 space-y-3 max-h-80 overflow-y-auto scrollbar-hide">
                {steps.map((step, index) => {
                    const isLatest = index === steps.length - 1 && status === 'streaming';

                    return (
                        <div
                            key={step.step}
                            className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-300 animate-in slide-in-from-left-2 ${isLatest
                                ? 'bg-brand-blue/10 border border-brand-blue/30 shadow-[0_0_15px_rgba(110,226,245,0.1)]'
                                : 'bg-white/5 border border-white/10'
                                }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex-shrink-0 mt-0.5">
                                {isLatest ? (
                                    <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-medium ${isLatest ? 'text-brand-blue' : 'text-white'}`}>
                                    {step.title}
                                </p>
                                {step.detail && (
                                    <p className="text-xs text-brand-text-dim mt-0.5 line-clamp-1">
                                        {step.detail}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Loading state when no steps yet */}
                {status === 'streaming' && steps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                        <p className="text-sm text-brand-text-dim animate-pulse">Initializing Neural Engine...</p>
                    </div>
                )}

                {/* Error state */}
                {status === 'error' && error && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 animate-in zoom-in-95 duration-200">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-400">Generation Failed</p>
                            <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
                        </div>
                    </div>
                )}

                {/* Result Preview (Success State) */}
                {status === 'complete' && players.length > 0 && (
                    <div className="mt-2 space-y-3 animate-in zoom-in-95 duration-300">
                        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold text-green-400 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" />
                                    Optimal Fantasy Lineup
                                </p>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 uppercase tracking-wider font-bold">
                                    Recommended
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {players.map((p, i) => (
                                    <div key={p.player_id} className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 group hover:border-brand-blue/30 transition-colors">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-brand-dark flex items-center justify-center border border-white/10 group-hover:border-brand-blue/50">
                                            {p.headshot_url ? (
                                                <img src={p.headshot_url} alt={p.player_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs text-brand-text-dim">#{i + 1}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-white truncate">{p.player_name}</p>
                                            <p className="text-[10px] text-brand-text-dim flex items-center gap-1">
                                                <span>{p.team_code}</span>
                                                <span className="w-1 h-1 rounded-full bg-brand-text-dim opacity-50" />
                                                <span>{p.position}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-mono text-brand-blue">{p.fantasy_avg?.toFixed(1)}</p>
                                            <p className="text-[8px] text-brand-text-dim uppercase">Avg FP</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 mt-4 px-1">
                                <Loader2 className="w-3 h-3 text-brand-blue animate-spin" />
                                <p className="text-[11px] text-brand-text-dim italic">
                                    Redirecting to lineup court...
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Decoration */}
            {status === 'streaming' && (
                <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-brand-blue/40" />
                        <p className="text-[10px] text-brand-text-dim uppercase tracking-tighter">
                            Searching data for all active matchups...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
