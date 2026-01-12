"use client";

import React from 'react';
import { Tile } from '../Tile';
import { TileData, PlayerState } from './types';
import { useDroppable } from '@dnd-kit/core';

interface GameTableProps {
    indicator: TileData | null;
    okeyTile: TileData | null;
    centerCount: number;
    lastDiscard: TileData | null;
    isMyTurn: boolean;
    mode?: 'standard' | '101';
    players?: PlayerState[];
    currentUserId?: string;
    onDrawCenter: () => void;
    onDrawLeft: () => void;
    onShowIndicator: () => void;
    hasIndicatorInHand: boolean;
    canShowIndicator: boolean;
}

export const GameTable: React.FC<GameTableProps> = ({
    indicator,
    okeyTile,
    centerCount,
    lastDiscard,
    isMyTurn,
    mode = 'standard',
    players = [],
    currentUserId,
    onDrawCenter,
    onDrawLeft,
    onShowIndicator,
    hasIndicatorInHand,
    canShowIndicator
}) => {
    const is101 = mode === '101';

    // Find relative positions
    const myIdx = players.findIndex(p => p.id === currentUserId);
    const getPlayerByRelativePos = (offset: number) => {
        if (myIdx === -1 || players.length === 0) return null;
        return players[(myIdx + offset) % players.length];
    };

    const topPlayer = getPlayerByRelativePos(2);
    const leftPlayer = getPlayerByRelativePos(1);
    const rightPlayer = getPlayerByRelativePos(3);
    const me = players[myIdx];

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1000px] h-[600px] flex items-center justify-center">
            {/* Center Felt / Wood Base */}
            <div className={`absolute inset-0 rounded-[200px] blur-3xl scale-110 transition-colors duration-1000 ${is101 ? 'bg-red-950/20' : 'bg-green-950/20'}`}></div>

            {/* --- 101 Opened Quadrants --- */}
            {is101 && (
                <div className="absolute inset-0 pointer-events-none">
                    {/* Top Player Opened */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-wrap gap-2 justify-center max-w-lg opacity-80">
                        {topPlayer?.openedSets?.map((set: TileData[], i: number) => (
                            <OpenedSet key={i} tiles={set} playerId={topPlayer.id} setIndex={i} />
                        ))}
                    </div>
                    {/* Left Player Opened */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 rotate-90 opacity-80">
                        {leftPlayer?.openedSets?.map((set: TileData[], i: number) => (
                            <OpenedSet key={i} tiles={set} playerId={leftPlayer.id} setIndex={i} />
                        ))}
                    </div>
                    {/* Right Player Opened */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 -rotate-90 opacity-80">
                        {rightPlayer?.openedSets?.map((set: TileData[], i: number) => (
                            <OpenedSet key={i} tiles={set} playerId={rightPlayer.id} setIndex={i} />
                        ))}
                    </div>
                    {/* My Opened */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap gap-2 justify-center max-w-lg z-20">
                        {me?.openedSets?.map((set: TileData[], i: number) => (
                            <OpenedSet key={i} tiles={set} playerId={me.id} setIndex={i} />
                        ))}
                    </div>
                </div>
            )}

            <div className={`flex items-center gap-16 relative z-10 transition-transform ${is101 ? 'scale-75' : ''}`}>
                {/* Indicator Tile (Gösterge) */}
                <div className="flex flex-col items-center gap-4 group">
                    <div className="text-[10px] font-black text-white/30 tracking-[0.3em] uppercase">GÖSTERGE</div>
                    <div className="relative">
                        {indicator && <Tile {...indicator} size="lg" className={`shadow-2xl ring-2 ${is101 ? 'ring-red-500/30' : 'ring-white/5'}`} />}
                        {canShowIndicator && hasIndicatorInHand && (
                            <button
                                onClick={onShowIndicator}
                                className={`absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-black text-[10px] animate-bounce shadow-xl ${is101 ? 'bg-red-600 text-white shadow-red-900/50' : 'bg-yellow-500 text-black shadow-yellow-900/50'
                                    }`}
                            >
                                GÖSTER! +1
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Deck */}
                <div className="relative group cursor-pointer" onClick={isMyTurn ? onDrawCenter : undefined}>
                    <div className="text-[10px] font-black text-white/30 tracking-[0.3em] uppercase absolute -top-8 left-1/2 -translate-x-1/2">DESTE</div>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className={`absolute border rounded-xl transition-colors duration-1000 ${is101 ? 'bg-red-900/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}
                            style={{
                                width: '64px',
                                height: '80px',
                                transform: `translate(${-i * 2}px, ${-i * 2}px)`,
                                zIndex: -i
                            }}
                        />
                    ))}
                    <Tile color="fake" value={0} size="lg" isBack className={`shadow-2xl transition-all ${isMyTurn ? 'group-hover:-translate-y-4 group-hover:ring-2 group-hover:ring-yellow-400' : ''}`} />
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white font-black text-xs border border-white/10 backdrop-blur-md">
                        {centerCount}
                    </div>
                </div>

                {/* Left Discard Pile */}
                <div className="relative group cursor-pointer" onClick={isMyTurn ? onDrawLeft : undefined}>
                    <div className="text-[10px] font-black text-white/30 tracking-[0.3em] uppercase absolute -top-8 left-1/2 -translate-x-1/2">YANDAN AL</div>
                    {lastDiscard ? (
                        <Tile
                            {...lastDiscard}
                            size="lg"
                            className={`shadow-2xl transition-all ${isMyTurn ? 'group-hover:scale-110 group-hover:ring-2 group-hover:ring-blue-400' : ''}`}
                        />
                    ) : (
                        <div className="w-16 h-20 rounded-xl border-4 border-dashed border-white/10 flex items-center justify-center text-white/10 font-black text-2xl">
                            Ø
                        </div>
                    )}
                </div>
            </div>

            {/* Discard Zone */}
            <div className={`absolute top-1/2 -translate-y-1/2 transition-all duration-500 ${is101 ? 'right-[-200px] scale-75' : 'right-[-100px]'}`}>
                <DiscardZone is101={is101} />
            </div>
        </div>
    );
};

const OpenedSet = ({ tiles, playerId, setIndex }: { tiles: TileData[], playerId: string, setIndex: number }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `set-${playerId}-${setIndex}`,
        data: { type: 'opened-set', playerId, setIndex }
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex bg-black/40 p-1 rounded-lg border backdrop-blur-sm -space-x-4 transition-all ${isOver ? 'border-yellow-400 bg-yellow-400/10 scale-110' : 'border-white/5'}`}
        >
            {tiles.map((t, i) => <Tile key={i} {...t} size="sm" className="scale-75 shadow-none" />)}
        </div>
    );
};

const DiscardZone = ({ is101 }: { is101?: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'discard-zone' });
    return (
        <div
            ref={setNodeRef}
            className={`
                w-32 h-40 rounded-3xl border-4 border-dashed transition-all flex flex-col items-center justify-center gap-2
                ${isOver ? (is101 ? 'bg-red-600/30 border-red-500 scale-110' : 'bg-red-500/20 border-red-500 scale-110') : 'bg-white/5 border-white/10'}
            `}
        >
            <span className="text-4xl opacity-50">{is101 ? "💀" : "🗑️"}</span>
            <span className="text-[10px] font-black text-white/30 uppercase">TAŞ AT</span>
        </div>
    );
};
