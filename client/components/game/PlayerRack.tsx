"use client";

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TileData } from './types';
import { DraggableTile } from './DraggableTile';

interface PlayerRackProps {
    rackSlots: (TileData | null)[];
    isMyTurn: boolean;
    okeyTile: TileData | null;
    mode: 'standard' | '101';
    onDiscard: (id: number) => void;
    onFlip: (id: number) => void;
    flippedTileIds: Set<number>;
    onAutoArrange: () => void;
    isArranging: boolean;
    showOkeyHint: boolean;
    onOpen?: () => void;
    currentSum?: number;
    t: (key: string) => string;
}

export const PlayerRack: React.FC<PlayerRackProps> = ({
    rackSlots,
    isMyTurn,
    okeyTile,
    mode,
    onDiscard,
    onFlip,
    flippedTileIds,
    onAutoArrange,
    isArranging,
    showOkeyHint,
    onOpen,
    currentSum = 0,
    t
}) => {
    const is101 = mode === '101';

    return (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-7xl h-[280px] z-50">
            {/* Action Bar */}
            <div className="absolute -top-16 left-0 right-0 flex items-center justify-between pointer-events-none">
                <div className="flex gap-4 pointer-events-auto">
                    <button
                        onClick={onAutoArrange}
                        disabled={isArranging}
                        className={`
                            bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-white font-black text-xs uppercase tracking-widest shadow-2xl transition-all
                            hover:bg-yellow-500 hover:text-black hover:border-yellow-400 active:scale-95 disabled:opacity-50 group flex items-center gap-2
                        `}
                    >
                        <span className={`text-xl transition-transform duration-500 ${isArranging ? 'animate-spin' : 'group-hover:rotate-180'}`}>🪄</span>
                        {isArranging ? "DÜZENLENİYOR..." : "AKILLI SIRALA"}
                    </button>

                    {is101 && (
                        <div className="flex items-center gap-2">
                            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-2xl">
                                <span className="text-[10px] text-white/40 font-black tracking-widest leading-none">TOPLAM</span>
                                <span className={`text-xl font-black tabular-nums transition-colors ${currentSum >= 101 ? 'text-green-400' : 'text-red-400'}`}>
                                    {currentSum}
                                </span>
                            </div>
                            <button
                                onClick={onOpen}
                                disabled={currentSum < 101}
                                className={`
                                    px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all border
                                    ${currentSum >= 101
                                        ? 'bg-green-500 text-black border-green-400 hover:bg-green-400 active:scale-95 animate-pulse'
                                        : 'bg-black/40 text-white/20 border-white/5 cursor-not-allowed opacity-50'}
                                `}
                            >
                                ELİ AÇ
                            </button>
                        </div>
                    )}
                </div>

                {/* Indicator of Turn */}
                <div className={`pointer-events-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all duration-500 border ${isMyTurn
                    ? (is101 ? 'bg-red-600 text-white border-red-500 animate-pulse scale-105' : 'bg-yellow-500 text-black border-yellow-400 animate-pulse scale-105')
                    : 'bg-black/40 text-white/40 border-white/5'
                    }`}>
                    {isMyTurn ? "SIRA SİZDE" : "SIRANI BEKLE"}
                </div>
            </div>

            {/* Okey Flip Hint */}
            {showOkeyHint && (
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 pointer-events-none z-[100] animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 p-[2px] rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                        <div className="bg-black/90 backdrop-blur-xl px-8 py-4 rounded-2xl flex items-center gap-4">
                            <span className="text-3xl animate-bounce">💡</span>
                            <div className="flex flex-col">
                                <span className="text-yellow-400 font-black text-sm uppercase tracking-widest">PRO İPUCU</span>
                                <span className="text-white/90 text-sm font-bold">Okeyi çevirmek için sağ tıkla!</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Rack Slot Rendering */}
            <div className="relative w-full h-full bg-[#3d2b1f] border-x-[12px] border-b-[12px] border-[#2a1d15] rounded-b-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] p-4 flex flex-col gap-4">
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10 pointer-events-none"></div>

                {[0, 1].map(row => (
                    <div key={row} className="flex-1 flex gap-2">
                        {Array.from({ length: 15 }).map((_, col) => {
                            const index = row * 15 + col;
                            const tile = rackSlots[index];
                            return <Slot key={index} index={index} tile={tile} isMyTurn={isMyTurn} onDiscard={onDiscard} onFlip={onFlip} flippedTileIds={flippedTileIds} okeyTile={okeyTile} />;
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Slot = ({ index, tile, isMyTurn, onDiscard, onFlip, flippedTileIds, okeyTile }: any) => {
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });

    return (
        <div
            ref={setNodeRef}
            className={`
                flex-1 rounded-xl border transition-all relative
                ${isOver ? 'bg-white/20 border-white/50 scale-105 z-10' : 'bg-black/20 border-white/5'}
            `}
        >
            {tile && (
                <DraggableTile
                    tile={tile}
                    isMyTurn={isMyTurn}
                    onDiscard={onDiscard}
                    isOkey={okeyTile ? (tile.color === okeyTile.color && tile.value === okeyTile.value) : false}
                    onFlip={onFlip}
                    isFlipped={flippedTileIds.has(tile.id)}
                />
            )}
        </div>
    );
};
