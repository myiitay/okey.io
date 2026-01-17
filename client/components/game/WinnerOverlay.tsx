import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, RoomData } from './types';
import { soundManager } from '@/utils/soundManager';
import { useLanguage } from '@/contexts/LanguageContext';

interface WinnerOverlayProps {
    gameState: GameState;
    currentUser: { id: string; name: string };
    roomData: RoomData;
    onRestartVote: () => void;
    onLeave: () => void;
}

export const WinnerOverlay: React.FC<WinnerOverlayProps> = ({
    gameState,
    currentUser,
    roomData,
    onRestartVote,
    onLeave
}) => {
    const { t } = useLanguage();
    const winner = roomData.players.find(p => p.id === gameState.winnerId);
    const isMe = gameState.winnerId === currentUser.id;

    // Calculate restart status
    const readyCount = roomData.players.filter(p => p.readyToRestart).length;
    const totalPlayers = roomData.players.length;
    const amIReady = roomData.players.find(p => p.id === currentUser.id)?.readyToRestart;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-[#1e1b2e] rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border-b-8 border-gray-900 border"
            >
                {/* Header Section */}
                <div className={`p-8 text-center ${isMe ? 'bg-gradient-to-b from-yellow-500/20 to-orange-500/10' : 'bg-gradient-to-b from-indigo-500/20 to-purple-500/10'}`}>
                    <motion.div
                        initial={{ rotate: -10, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 12 }}
                        className="text-8xl mb-4"
                    >
                        {isMe ? '🏆' : '🎮'}
                    </motion.div>

                    <h2 className="text-4xl font-black text-white mb-2">
                        {isMe ? 'TEBRİKLER!' : 'OYUN BİTTİ'}
                    </h2>

                    <div className="inline-block px-6 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xl font-bold text-yellow-400">
                        {roomData.settings.isPaired ? (
                            `${t("team") || "Takım"} ${winner?.team} (${winner?.name})`
                        ) : (
                            winner?.name
                        )} {gameState.winType === 'double' ? 'ÇİFTE BİTİRDİ!' : 'BİTİRDİ!'}
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8 space-y-8">
                    {/* Score Summary (Simplified for now) */}
                    <div className="bg-black/20 rounded-[2rem] p-6 border border-white/5">
                        <h3 className="text-center text-xs font-black text-white/30 uppercase tracking-widest mb-4">PUAN DURUMU</h3>
                        <div className="space-y-3">
                            {roomData.settings.isPaired ? (
                                <>
                                    {[1, 2].map(teamNum => (
                                        <div key={teamNum} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">👥</span>
                                                <span className={`font-bold ${winner?.team === teamNum ? 'text-yellow-400' : 'text-white/70'}`}>
                                                    {t("team") || "Takım"} {teamNum}
                                                </span>
                                            </div>
                                            <div className="font-mono font-black text-white">
                                                {roomData.winScores[`Team ${teamNum}`] || 0}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                roomData.players.map(p => (
                                    <div key={p.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{p.avatar}</span>
                                            <span className={`font-bold ${p.id === gameState.winnerId ? 'text-yellow-400' : 'text-white/70'}`}>
                                                {p.name}
                                            </span>
                                        </div>
                                        <div className="font-mono font-black text-white">
                                            {roomData.winScores[p.name] || 0}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-4">
                        <div className="text-center">
                            <p className="text-white/40 text-sm font-bold mb-2">
                                Yeni oyun için hazır mısın? ({readyCount}/{totalPlayers})
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    soundManager.play('click');
                                    onRestartVote();
                                }}
                                disabled={amIReady}
                                className={`flex-1 py-5 rounded-2xl font-black text-xl shadow-xl transition-all transform active:scale-95 ${amIReady
                                    ? 'bg-green-500/20 text-green-400 cursor-not-allowed border-2 border-green-500/30'
                                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 active:translate-y-1'
                                    }`}
                            >
                                {amIReady ? 'HAZIR!' : 'YENİDEN BAŞLAT'}
                            </button>

                            <button
                                onClick={() => {
                                    soundManager.play('click');
                                    onLeave();
                                }}
                                className="px-8 py-5 bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 rounded-2xl font-black transition-all border border-white/10"
                            >
                                AYRIL
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="px-8 py-4 bg-black/40 text-center">
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                        Tüm oyuncular hazır olduğunda yeni el başlar
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
