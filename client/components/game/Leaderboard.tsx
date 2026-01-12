"use client";

import React from 'react';

interface LeaderboardProps {
    scores: [string, number][];
    players: any[];
    currentUser: { name: string };
    mode?: 'standard' | '101';
    t: (key: string) => string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ scores, players, currentUser, mode, t }) => {
    const is101 = mode === '101';
    return (
        <div className={`absolute top-4 right-4 z-[100] bg-black/40 backdrop-blur-xl rounded-2xl border p-4 shadow-2xl transition-all hover:border-white/20 group ${is101 ? 'border-red-500/20 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'border-white/10'}`}>
            <div className={`flex items-center gap-2 mb-3 border-b pb-2 ${is101 ? 'border-red-500/10' : 'border-white/10'}`}>
                <span className="text-xl">{is101 ? "☄️" : "🏆"}</span>
                <span className="text-white font-black text-xs uppercase tracking-widest">{t("leaderboard")}</span>
            </div>
            <div className="flex flex-col gap-2 min-w-[150px]">
                {scores.map(([name, score]: any) => (
                    <div key={name} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px]">
                                {players.find((p: any) => p.name === name)?.avatar || "👤"}
                            </div>
                            <span className={`text-[10px] font-bold ${name === currentUser.name ? (is101 ? 'text-red-400' : 'text-yellow-400') : 'text-white/70'}`}>{name}</span>
                        </div>
                        <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded-full">{score}</span>
                    </div>
                ))}
            </div>
            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-[2px] group-hover:w-[80%] transition-all duration-500 ${is101 ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-yellow-500'}`}></div>
        </div>
    );
};
