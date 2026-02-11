'use client';

import Image from 'next/image';
import { X, Sparkles } from 'lucide-react';
import type { GameResult } from '@/types';

interface PredictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    games: GameResult[];
    onSelectGame: (game: GameResult) => void;
    isSubmitting: boolean;
}

export function PredictionModal({
    isOpen,
    onClose,
    games,
    onSelectGame,
    isSubmitting
}: PredictionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-md bg-brand-dark border border-brand-blue/30 rounded-2xl shadow-glow-blue overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-brand-blue/20 bg-brand-blue/5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-blue" />
                        <h3 className="text-lg font-semibold text-white">Select Game to Predict</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-white/10 text-brand-text-dim hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    {games.length === 0 ? (
                        <div className="text-center py-8 text-brand-text-dim">
                            No games available for today.
                        </div>
                    ) : (
                        games.map((game) => (
                            <button
                                key={game.id}
                                onClick={() => onSelectGame(game)}
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand-blue/50 hover:bg-brand-blue/10 transition-all duration-200 group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {/* Away Team */}
                                <div className="flex items-center gap-3 flex-1">
                                    {game.awayTeam.logoUrl ? (
                                        <Image src={game.awayTeam.logoUrl} alt={game.awayTeam.name} width={32} height={32} className="w-8 h-8 object-contain" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                                            {game.awayTeam.code}
                                        </div>
                                    )}
                                    <span className="font-medium text-brand-text-light group-hover:text-white transition-colors">
                                        {game.awayTeam.code}
                                    </span>
                                </div>

                                {/* VS */}
                                <div className="px-4 text-xs font-bold text-brand-text-dim text-center">
                                    VS
                                </div>

                                {/* Home Team */}
                                <div className="flex items-center gap-3 flex-1 justify-end">
                                    <span className="font-medium text-brand-text-light group-hover:text-white transition-colors">
                                        {game.homeTeam.code}
                                    </span>
                                    {game.homeTeam.logoUrl ? (
                                        <Image src={game.homeTeam.logoUrl} alt={game.homeTeam.name} width={32} height={32} className="w-8 h-8 object-contain" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                                            {game.homeTeam.code}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Loading Overlay */}
                {isSubmitting && (
                    <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-brand-blue animate-pulse">Consulting AI Oracle...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
