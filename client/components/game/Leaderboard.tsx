import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { RoomPlayer } from './types';

interface LeaderboardProps {
    isOpen: boolean;
    onClose: () => void;
    players: RoomPlayer[];
    winScores: Record<string, number>;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ isOpen, onClose, players, winScores }) => {
    // Sort players by score
    const sortedPlayers = [...(players || [])].sort((a, b) => {
        const scoreA = winScores[a.name] || 0;
        const scoreB = winScores[b.name] || 0;
        return scoreB - scoreA;
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
                    />

                    {/* Board */}
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md"
                    >
                        <div className="bg-[#1e1b2e] border border-white/10 shadow-2xl rounded-3xl overflow-hidden">
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏆</span>
                                    <h3 className="text-xl font-bold text-white">SKOR TABLOSU</h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* List */}
                            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {sortedPlayers.map((p, i) => {
                                    const score = winScores[p.name] || 0;
                                    const isTop = i === 0 && score > 0;

                                    return (
                                        <div
                                            key={p.id}
                                            className={`
                                                flex items-center gap-4 p-3 rounded-2xl border transition-all
                                                ${isTop
                                                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/30'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm
                                                ${isTop ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/50'}
                                            `}>
                                                #{i + 1}
                                            </div>

                                            <div className="text-2xl">{p.avatar || "👤"}</div>

                                            <div className="flex-1">
                                                <div className={`font-bold ${isTop ? 'text-yellow-100' : 'text-white'}`}>
                                                    {p.name}
                                                </div>
                                                <div className="text-xs text-white/30">
                                                    {p.connected ? 'Çevrimiçi' : 'Bağlantı Koptu'}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end">
                                                <div className={`text-2xl font-black ${isTop ? 'text-yellow-400' : 'text-white/80'}`}>
                                                    {score}
                                                </div>
                                                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                                    PUAN
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {sortedPlayers.length === 0 && (
                                    <div className="text-center py-8 text-white/30">
                                        Henüz oyuncu yok
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
