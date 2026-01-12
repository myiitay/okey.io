"use client";

import React from 'react';
import { PlayerState } from './types';

interface OpponentAreaProps {
    players: PlayerState[];
    currentUser: { id: string };
    playersMap: Record<string, { name: string, avatar: string }>;
    disconnectedPlayers: Set<string>;
    mode?: 'standard' | '101';
    t: (key: string) => string;
}

export const OpponentArea: React.FC<OpponentAreaProps> = ({
    players,
    currentUser,
    playersMap,
    disconnectedPlayers,
    mode,
    t
}) => {
    const is101 = mode === '101';
    const getRelativePlayer = (offset: number) => {
        if (!players || players.length === 0) return null;
        const myIndex = players.findIndex(p => p.id === currentUser.id);
        if (myIndex === -1) return null;
        return players[(myIndex + offset) % players.length];
    };

    const rightPlayer = getRelativePlayer(1);
    const topPlayer = getRelativePlayer(2);
    const leftPlayer = getRelativePlayer(3);

    return (
        <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
                {/* RIGHT PLAYER */}
                {rightPlayer && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-4">
                        <PlayerAvatar player={rightPlayer} playersMap={playersMap} disconnectedPlayers={disconnectedPlayers} is101={is101} />
                        <OpponentRack player={rightPlayer} position="right" disconnectedPlayers={disconnectedPlayers} is101={is101} />
                    </div>
                )}

                {/* TOP PLAYER */}
                {topPlayer && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
                        <PlayerAvatar player={topPlayer} playersMap={playersMap} disconnectedPlayers={disconnectedPlayers} is101={is101} />
                        <OpponentRack player={topPlayer} position="top" disconnectedPlayers={disconnectedPlayers} is101={is101} />
                    </div>
                )}

                {/* LEFT PLAYER */}
                {leftPlayer && (
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center flex-row-reverse gap-4">
                        <PlayerAvatar player={leftPlayer} playersMap={playersMap} disconnectedPlayers={disconnectedPlayers} is101={is101} />
                        <OpponentRack player={leftPlayer} position="left" disconnectedPlayers={disconnectedPlayers} is101={is101} />
                    </div>
                )}
            </div>
        </div>
    );
};

const PlayerAvatar = ({ player, playersMap, disconnectedPlayers, is101 }: any) => {
    if (!player) return null;
    const info = playersMap[player.id] || { name: '...', avatar: '👤' };
    const isDisconnected = disconnectedPlayers.has(player.id);

    return (
        <div className={`flex flex-col items-center z-20 relative transition-all duration-1000 ${isDisconnected ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}>
            <div className="w-16 h-16 rounded-full bg-black/40 border-2 border-white/10 flex items-center justify-center text-3xl shadow-lg backdrop-blur-sm relative">
                {info.avatar}
                {player.isTurn && !isDisconnected && <div className={`absolute inset-0 rounded-full border-4 animate-pulse ${is101 ? 'border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'border-yellow-400'}`}></div>}
            </div>
            <div className="bg-black/60 px-3 py-1 rounded-full text-white font-bold text-sm backdrop-blur-md mt-2 border border-white/5 shadow-md">
                {info.name}
            </div>
            {player.hasShownIndicator && (
                <div className={`absolute -bottom-8 px-2 py-0.5 rounded text-[10px] font-black animate-bounce whitespace-nowrap ${is101 ? 'bg-red-600/90 text-white' : 'bg-yellow-500/90 text-black'}`}>
                    GÖSTERGE YAPTI! 🏆
                </div>
            )}
        </div>
    );
};

const OpponentRack = ({ player, position, disconnectedPlayers, is101 }: any) => {
    if (!player) return null;
    const isDisconnected = disconnectedPlayers.has(player.id);
    const isTurn = player.isTurn;

    return (
        <div
            className={`
                relative bg-[#5d4037] border-2 border-[#3e2723] rounded-lg shadow-2xl flex items-center justify-center
                ${position === 'top' ? 'w-96 h-24' : 'w-24 h-96'} 
                transition-all duration-300 ease-in-out
                ${isDisconnected ? 'translate-y-[500px] rotate-12 opacity-0' : ''} 
                ${isTurn && !isDisconnected ? (is101 ? 'ring-4 ring-red-600 shadow-[0_0_50px_rgba(220,38,38,0.6)] z-30 scale-105' : 'ring-4 ring-yellow-400 shadow-[0_0_50px_rgba(255,215,0,0.6)] z-30 scale-105') : ''}
            `}
            style={{
                transformOrigin: 'bottom center',
                transform: isDisconnected ? 'rotateX(90deg) translateY(200px) rotateZ(20deg)' : 'none'
            }}
        >
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
            {position === 'top' ? (
                <div className="w-[95%] h-[2px] bg-[#3e2723]/50 absolute top-1/2 left-1/2 -translate-x-1/2"></div>
            ) : (
                <div className="h-[95%] w-[2px] bg-[#3e2723]/50 absolute top-1/2 left-1/2 -translate-y-1/2"></div>
            )}

            {/* Visual representation of tile count */}
            <div className={`flex ${position === 'top' ? 'flex-row' : 'flex-col'} gap-1 opacity-40`}>
                {Array.from({ length: Math.min(player.handCount || 0, 14) }).map((_, i) => (
                    <div key={i} className={`${position === 'top' ? 'w-5 h-7' : 'w-7 h-5'} bg-white/20 rounded-sm border border-black/20`} />
                ))}
            </div>
        </div>
    );
};
