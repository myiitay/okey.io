import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WinnerOverlayProps {
    gameState: any; // Type strictly if possible
    currentUser: any;
    roomData: any;
    onRestartVote: () => void;
    onLeave: () => void;
    className?: string; // Allow passing styles
}

export const WinnerOverlay: React.FC<WinnerOverlayProps> = ({
    gameState,
    currentUser,
    roomData,
    onRestartVote,
    onLeave
}) => {
    const isDraw = !gameState.winnerId;
    const winner = !isDraw ? gameState.players.find((p: any) => p.id === gameState.winnerId) : null;
    const isMe = !isDraw && winner?.id === currentUser?.id;
    const is101Mode = roomData?.gameMode === '101';

    // Restart state from roomData
    const playersList = roomData?.players || [];
    const voteCount = roomData?.restartCount || 0;
    const totalPlayers = playersList.length;

    const myPlayerState = playersList.find((p: any) => p.id === currentUser.id);
    const iVoted = myPlayerState?.readyToRestart;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center"
            >
                <motion.div
                    initial={{ scale: 0.8, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative bg-[#1a1a2e] border-4 border-yellow-500/30 rounded-[3rem] p-12 max-w-2xl w-full text-center shadow-[0_0_100px_rgba(234,179,8,0.3)] overflow-hidden"
                >
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1),transparent_70%)] animate-pulse-slow"></div>
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-[url('/confetti.gif')] bg-cover"></div>

                    <div className="relative z-10">
                        {isDraw ? (
                            <>
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="text-8xl mb-6 filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                >
                                    🤝
                                </motion.div>
                                <h2 className="text-6xl font-black bg-gradient-to-r from-blue-300 via-white to-blue-300 bg-clip-text text-transparent mb-4 tracking-tight">
                                    BERABERE!
                                </h2>
                                <p className="text-white/60 text-xl font-medium mb-12">
                                    Bütün taşlar bitti, kazanan çıkmadı.
                                </p>
                            </>
                        ) : isMe ? (
                            <>
                                <motion.div
                                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                                    className="text-8xl mb-6 filter drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]"
                                >
                                    🏆
                                </motion.div>
                                <h2 className="text-6xl font-black bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 bg-clip-text text-transparent mb-4 tracking-tight">
                                    KAZANDIN!
                                </h2>
                                <p className="text-yellow-100/60 text-xl font-medium mb-12">
                                    Mükemmel bir oyun çıkardın!
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="text-7xl mb-6 grayscale opacity-80">👏</div>
                                <h2 className="text-5xl font-black text-white mb-2 tracking-tight">
                                    {winner?.name || "Biri"} Kazandı
                                </h2>
                                <p className="text-white/40 text-lg font-medium mb-12">
                                    Bir sonraki elde şansın dönebilir!
                                </p>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={onRestartVote}
                                disabled={iVoted}
                                className={`
                                    relative overflow-hidden group py-5 rounded-2xl font-black text-xl transition-all duration-300
                                    ${iVoted
                                        ? 'bg-green-500/20 text-green-400 cursor-default border-2 border-green-500/50'
                                        : 'bg-white text-black hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]'
                                    }
                                `}
                            >
                                <div className="relative z-10 flex items-center justify-center gap-3">
                                    {iVoted ? (
                                        <>
                                            <span>✅ HAZIRSIN</span>
                                            <span className="bg-black/20 px-3 py-1 rounded-lg text-sm">
                                                {voteCount}/{totalPlayers}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span>TEKRAR OYNA</span>
                                            <span className="bg-black/10 px-3 py-1 rounded-lg text-sm">
                                                {voteCount}/{totalPlayers}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {iVoted && (
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '100%' }}
                                        className="absolute inset-0 bg-green-500/10"
                                    />
                                )}
                            </button>

                            <button
                                onClick={onLeave}
                                className="bg-white/5 hover:bg-white/10 border-2 border-white/10 text-white py-5 rounded-2xl font-bold text-xl transition-all hover:border-white/30"
                            >
                                MENÜYE DÖN
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
