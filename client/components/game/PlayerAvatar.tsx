import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlayerAvatarProps {
    player: {
        id: string;
        isTurn: boolean;
    };
    info: {
        name: string;
        avatar: string;
        frameId?: string;
        team?: 1 | 2;
    };
    isDisconnected?: boolean;
    isAnimated?: boolean;
    position: 'right' | 'top' | 'left' | 'bottom';
    turnTimer?: number;
    activeEmote?: { id: number, emote: string, text?: string };
}

const getFrameStyle = (frameId?: string, isAnimated?: boolean) => {
    const base = 'rounded-full border-4 transition-all duration-300 ';
    let style = '';

    switch (frameId) {
        case 'gold': style = 'border-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'; break;
        case 'neon': style = 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)]'; break;
        case 'fire': style = 'border-[#ff4500] shadow-[0_0_15px_rgba(255,69,0,0.3)]'; break;
        case 'royal': style = 'border-[#8a2be2] shadow-[0_0_15px_rgba(138,43,226,0.3)]'; break;
        case 'emerald': style = 'border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]'; break;
        default: style = 'border-white/10'; break;
    }

    if (isAnimated) {
        return `${base} ${style} ring-4 ring-white/10 animate-pulse`;
    }
    return `${base} ${style}`;
};

export const PlayerAvatar = React.memo(({ player, info, isDisconnected = false, isAnimated = false, position, turnTimer, activeEmote }: PlayerAvatarProps) => {
    const { t } = useLanguage();
    if (!player) return null;

    return (
        <div className={`relative flex flex-col items-center gap-2 ${isAnimated ? 'animate-[float-soft_3s_ease-in-out_infinite]' : ''}`}>
            {/* Emote Bubble */}
            <AnimatePresence>
                {activeEmote && (
                    <motion.div
                        initial={{ scale: 0, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0, y: 20, opacity: 0 }}
                        className="absolute -top-20 bg-white text-black px-4 py-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] z-50 border-2 border-yellow-400 min-w-[100px] flex items-center gap-2"
                    >
                        <span className="text-2xl">{activeEmote.emote}</span>
                        <span className="text-xs font-bold whitespace-nowrap">
                            {(() => {
                                const map: Record<string, string> = {
                                    "👋": "emote_selam", "🍀": "emote_luck", "👏": "emote_congrats",
                                    "🙏": "emote_thanks", "⚡": "emote_hurry", "🃏": "emote_hand"
                                };
                                return t(map[activeEmote.emote] || "");
                            })()}
                        </span>
                        {/* Tail */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r-2 border-b-2 border-yellow-400"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Disconnect Notification */}
            {isDisconnected && (
                <div className="absolute -top-12 z-50 bg-red-600/90 text-white px-4 py-2 rounded-full font-bold animate-[bounce_1s_infinite] whitespace-nowrap">
                    🚫 OYUNDAN ÇIKTI
                </div>
            )}

            <div className={`w-16 h-16 bg-black/40 flex items-center justify-center text-3xl shadow-lg backdrop-blur-sm relative transition-all duration-500 ${getFrameStyle(info?.frameId, isAnimated)}`}>
                <span className={isAnimated ? 'animate-bounce' : ''} style={{ animationDuration: '4s' }}>
                    {info?.avatar || '👤'}
                </span>
                {player.isTurn && !isDisconnected && (
                    <>
                        <div className={`absolute inset-0 rounded-full border-4 ${turnTimer && turnTimer < 10 ? 'border-red-500 shadow-[0_0_15px_red]' : 'border-yellow-400 shadow-[0_0_15px_yellow]'} animate-pulse`}></div>
                        <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full ${turnTimer && turnTimer < 10 ? 'bg-red-600' : 'bg-yellow-500'} border-2 border-white flex items-center justify-center text-[11px] font-black text-white shadow-xl z-30`}>
                            {turnTimer || 25}
                        </div>
                    </>
                )}
                {/* Team Badge */}
                {info?.team && (
                    <div className={`absolute -bottom-2 -left-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-lg border border-white/20 z-20 ${info.team === 1 ? 'bg-blue-600 shadow-blue-500/50' : 'bg-red-600 shadow-red-500/50'}`}>
                        {t("team")?.toUpperCase() || "TAKIM"} {info.team}
                    </div>
                )}
            </div>
            <div className="bg-black/60 px-3 py-1 rounded-full text-white font-bold text-sm backdrop-blur-md border border-white/5 shadow-md">
                {info?.name || '...'}
            </div>
        </div>
    );
});
PlayerAvatar.displayName = 'PlayerAvatar';
