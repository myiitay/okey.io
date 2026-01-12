"use client";

import React from 'react';
import { useLanguage } from "@/contexts/LanguageContext";

interface WinnerOverlayProps {
    winner: any;
    isReady: boolean;
    readyCount: number;
    totalCount: number;
    players: any[];
    onRestart: () => void;
    onHome: () => void;
    mode?: 'standard' | '101';
    t: (key: string) => string;
}

export const WinnerOverlay: React.FC<WinnerOverlayProps> = ({
    winner,
    isReady,
    readyCount,
    totalCount,
    players,
    onRestart,
    onHome,
    mode = 'standard',
    t
}) => {
    const is101 = mode === '101';
    return (
        <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-700">
            {/* Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className={`absolute w-2 h-2 rounded-full animate-bounce ${is101 ? 'bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-yellow-400'}`}
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: Math.random()
                        }}
                    ></div>
                ))}
            </div>

            <div className={`bg-gradient-to-b from-white/10 to-white/5 border border-white/20 p-12 rounded-[3rem] text-center max-w-xl w-full mx-4 backdrop-blur-2xl relative overflow-hidden group ${is101 ? 'shadow-[0_0_100px_rgba(220,38,38,0.3)]' : 'shadow-[0_0_100px_rgba(234,179,8,0.3)]'}`}>
                <div className={`absolute -inset-24 blur-[100px] transition-colors duration-1000 ${is101 ? 'bg-red-600/10 group-hover:bg-red-600/20' : 'bg-yellow-500/10 group-hover:bg-yellow-500/20'}`}></div>

                <div className="relative">
                    <div className={`text-7xl mb-6 animate-bounce ${is101 ? 'text-red-500 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]' : 'text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]'}`}>{is101 ? '☄️' : '🏆'}</div>
                    <h2 className="text-5xl font-black text-white mb-2 tracking-tighter uppercase">{t("game_over")}</h2>
                    <p className="text-white/40 font-bold tracking-[0.3em] text-sm mb-8 uppercase">MUHTEŞEM BİR ZAFER!</p>

                    <div className="flex flex-col items-center gap-6 mb-10">
                        <div className={`w-24 h-24 rounded-full p-1 shadow-2xl ${is101 ? 'bg-gradient-to-br from-red-600 to-black shadow-[0_0_50px_rgba(220,38,38,0.4)]' : 'bg-gradient-to-br from-yellow-400 to-orange-600 shadow-[0_0_50px_rgba(234,179,8,0.4)]'}`}>
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-5xl">
                                {winner?.avatar || "👤"}
                            </div>
                        </div>
                        <div className="text-3xl font-black text-white">{winner?.name} KAZANDI!</div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-4 w-full">
                            <button
                                onClick={onRestart}
                                disabled={isReady}
                                className={`
                                    flex-1 relative group overflow-hidden px-8 py-4 rounded-full font-black text-lg transition-all duration-300
                                    ${isReady ? 'bg-green-500/20 text-green-400 border border-green-500/50 grayscale' : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(0,0,0,0.3)]'}
                                `}
                            >
                                <span className="relative z-10">
                                    {isReady ? "BEKLENİYOR..." : "TEKRAR OYNA"}
                                </span>
                                {!isReady && <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>}
                            </button>

                            <button
                                onClick={onHome}
                                className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white text-3xl hover:bg-white/10 hover:scale-110 active:scale-95 transition-all"
                                title="Ana Menüye Dön"
                            >
                                ↺
                            </button>
                        </div>

                        {/* Consensus Tracker */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-white/40 text-[10px] font-bold tracking-widest uppercase">
                                HERKES HEMFİKİR OLMALI
                            </div>
                            <div className="flex gap-2">
                                {players.map((p: any) => (
                                    <div
                                        key={p.id}
                                        title={p.name}
                                        className={`w-3 h-3 rounded-full border border-white/10 transition-all duration-500 ${p.readyToRestart ? 'bg-green-500 shadow-[0_0_10px_green] scale-125' : 'bg-white/10'}`}
                                    />
                                ))}
                            </div>
                            <div className="text-green-400 text-lg font-black tabular-nums">
                                {readyCount} / {totalCount}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
