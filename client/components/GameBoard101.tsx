"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { getSocket } from '@/utils/socket';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent } from '@dnd-kit/core';
import { useLanguage } from "@/contexts/LanguageContext";
import { TileData, GameState101, OpenedSet } from './game/types';
import { Tile } from './Tile';
import { soundManager } from '@/utils/soundManager';
import { motion, AnimatePresence } from 'framer-motion';

// --- Assets & Icons ---
const Icons = {
    Package: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22v-9" /></svg>,
    Sort: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
};

interface GameBoardProps {
    roomCode: string;
    currentUser: { id: string; name: string };
    gameMode?: '101' | 'standard';
    isSpectator?: boolean;
    initialGameState?: any;
    isFreshStart?: boolean;
    players: { id: string; name: string; score?: number; avatar?: string }[];
}

// Points Calculator
// --- Validation Helpers ---
const getEffective = (tile: TileData, okeyTile?: TileData) => {
    if (!tile) return { color: 'red', value: 0, isWild: false };
    if (tile.color === 'fake') {
        if (!okeyTile) return { color: 'blue', value: 1, isWild: false };
        return { color: okeyTile.color, value: okeyTile.value, isWild: false };
    }
    if (okeyTile && tile.color === okeyTile.color && tile.value === okeyTile.value) {
        return { color: tile.color, value: tile.value, isWild: true };
    }
    return { color: tile.color, value: tile.value, isWild: false };
};

const validateGroup = (tiles: TileData[], okeyTile?: TileData) => {
    if (tiles.length < 3 || tiles.length > 4) return false;
    const real = tiles.filter(t => !getEffective(t, okeyTile).isWild);
    if (real.length === 0) return true; // All wild
    const baseVal = getEffective(real[0], okeyTile).value;
    const colors = new Set<string>();
    for (const t of tiles) {
        const eff = getEffective(t, okeyTile);
        if (!eff.isWild) {
            if (eff.value !== baseVal) return false;
            if (colors.has(eff.color)) return false;
            colors.add(eff.color);
        }
    }
    return true;
};

const isValidSet = (tiles: TileData[], okeyTile?: TileData) => {
    if (validateGroup(tiles, okeyTile)) return true;
    if (tiles.length < 3) return false;
    // Basic Run Validity Check (Same Color)
    const real = tiles.filter(t => !getEffective(t, okeyTile).isWild);
    if (real.length === 0) return true;
    const color = getEffective(real[0], okeyTile).color;
    // Check color consistency
    for (const t of real) {
        if (getEffective(t, okeyTile).color !== color) return false;
    }
    return true;
};

const calculatePoints = (tiles: TileData[], okeyTile?: TileData) => {
    let sum = 0;
    tiles.forEach(t => {
        const eff = getEffective(t, okeyTile);
        sum += eff.value;
    });
    return sum;
};

// --- Main Component ---
export const GameBoard101: React.FC<GameBoardProps> = ({
    roomCode,
    currentUser,
    gameMode,
    isSpectator,
    initialGameState,
    isFreshStart,
    players: roomPlayers = []
}) => {
    const socket = getSocket();

    const getPlayerName = (id: string) => roomPlayers.find(p => p.id === id)?.name || "Player";
    const getPlayerAvatar = (id: string) => roomPlayers.find(p => p.id === id)?.avatar;

    // State
    const [gameState, setGameState] = useState<GameState101 | null>(initialGameState);
    const [rackSlots, setRackSlots] = useState<(TileData | null)[]>(Array(42).fill(null));
    const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
    const [pendingSets, setPendingSets] = useState<{ id: string, tiles: TileData[], points: number, valid?: boolean }[]>([]);

    // Dragging
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [activeDragTile, setActiveDragTile] = useState<TileData | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
    );

    // Socket Sync
    useEffect(() => {
        const onState = (s: GameState101) => {
            setGameState(s);
            updateRack(s);
        };
        socket.on('gameState', onState);
        if (initialGameState) onState(initialGameState);
        return () => { socket.off('gameState', onState); };
    }, []);

    // Rack Synchronization Logic
    const updateRack = (state: GameState101) => {
        const myPlayer = state.players.find(p => p.id === currentUser.id);
        if (!myPlayer) return;

        setRackSlots(prev => {
            const next = [...prev];
            const currentIds = new Set(next.filter(x => x).map(x => x!.id));
            const newHandIds = new Set(myPlayer.hand.map(x => x.id));

            // Clear removed
            for (let i = 0; i < next.length; i++) {
                if (next[i] && !newHandIds.has(next[i]!.id)) next[i] = null;
            }
            // Add new
            myPlayer.hand.forEach(t => {
                if (!currentIds.has(t.id)) {
                    const empty = next.indexOf(null);
                    if (empty !== -1) next[empty] = t;
                }
            });
            return next;
        });
    };

    const handleAction = (type: string, payload?: any) => {
        socket.emit("gameAction", { type, payload });
        if (type.includes('DRAW')) soundManager.play('deal');
        else soundManager.play('click');
    };

    const handleCreateSet = () => {
        if (selectedTileIds.size < 2) return;
        const tiles = rackSlots.filter(t => t && selectedTileIds.has(t.id)) as TileData[];
        tiles.sort((a, b) => a.value - b.value);
        const valid = isValidSet(tiles, gameState?.okeyTile);
        const pts = calculatePoints(tiles, gameState?.okeyTile);
        setPendingSets(prev => [...prev, { id: Date.now().toString(), tiles, points: pts, valid }]);
        setSelectedTileIds(new Set());
        soundManager.play('tile_place');
    };

    // DND Handlers
    const handleDragStart = (e: DragStartEvent) => {
        const idStr = e.active.id.toString();
        setActiveDragId(idStr);
        if (idStr.startsWith('tile-')) {
            const tid = parseInt(idStr.replace('tile-', ''));
            const slotTile = rackSlots.find(t => t?.id === tid);
            if (slotTile) setActiveDragTile(slotTile);
        }
    };

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        setActiveDragId(null);
        setActiveDragTile(null);

        if (!over) return;
        const tileId = parseInt(active.id.toString().replace('tile-', ''));

        // Actions
        if (over.id === 'discard-zone') { handleAction('DISCARD', { tileId }); return; }
        if (over.id === 'finish-zone') { handleAction('FINISH_GAME', { tileId }); return; }
        if (over.id.toString().startsWith('set-')) {
            handleAction('PROCESS_TILE', { tileId, targetSetId: over.id.toString().replace('set-', '') });
            return;
        }

        // Reorder Rack
        if (over.id.toString().startsWith('slot-')) {
            const targetIdx = parseInt(over.id.toString().replace('slot-', ''));
            setRackSlots(prev => {
                const copy = [...prev];
                const sourceIdx = copy.findIndex(t => t?.id === tileId);
                if (sourceIdx === -1) return prev;
                // Swap logic
                [copy[sourceIdx], copy[targetIdx]] = [copy[targetIdx], copy[sourceIdx]];
                return copy;
            });
            soundManager.play('tile_place');
        }
    };

    if (!gameState) return <div className="bg-[#2e5942] h-screen flex items-center justify-center text-white">Loading...</div>;

    const myPlayer = gameState.players.find(p => p.id === currentUser.id);
    const myIndex = gameState.players.findIndex(p => p.id === currentUser.id);
    const isMyTurn = myPlayer?.isTurn;

    // Relative Positions: 0=Me, 1=Right, 2=Top, 3=Left
    const getRelPlayer = (offset: number) => gameState.players[(myIndex + offset) % 4];
    const rightPlayer = getRelPlayer(1);
    const topPlayer = getRelPlayer(2);
    const leftPlayer = getRelPlayer(3);

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* MAIN BACKGROUND: Professional Green Table */}
            <div className="relative w-full h-screen overflow-hidden select-none font-sans bg-[#396d52]">

                {/* CSS Generated Felt Texture (Subtle Noise) */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
                <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/10 to-black/40"></div>

                {/* --- CENTER BOARD --- */}
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[320px] rounded-[40px] border-[6px] border-[#224433] bg-[#2a523d] shadow-2xl flex items-center justify-center">

                    {/* Brand */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl font-bold text-[#224433] opacity-30 tracking-widest pointer-events-none">101</div>

                    {/* DECK & INDICATOR */}
                    <div className="flex gap-16 items-center z-10">
                        {/* Deck Stack */}
                        <div onClick={() => isMyTurn && handleAction('DRAW_CENTER')} className={`group relative w-20 h-28 cursor-pointer transition-transform duration-200 hover:-translate-y-2 ${isMyTurn ? 'cursor-pointer' : 'cursor-default'}`}>
                            {/* Shadows for depth */}
                            <div className="absolute top-2 left-1 w-full h-full bg-[#3e2723] rounded-md shadow-lg border border-[#3e2723]"></div>
                            <div className="absolute top-1 left-0.5 w-full h-full bg-[#4e342e] rounded-md shadow-md border border-[#4e342e]"></div>
                            {/* The Top Card */}
                            <div className={`absolute top-0 left-0 w-full h-full bg-[#5d4037] rounded-md border-2 border-[#4e342e] flex items-center justify-center shadow-xl transition-all ${isMyTurn ? 'ring-4 ring-yellow-400 group-hover:bg-[#6d4c41]' : ''}`}>
                                <div className="w-12 h-16 border-2 border-dashed border-[#8d6e63]/30 rounded flex items-center justify-center">
                                    <span className="text-[#8d6e63]/40 font-serif text-2xl">♦</span>
                                </div>
                            </div>
                            {/* Count Badge */}
                            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 border-2 border-white text-white font-bold flex items-center justify-center shadow-lg z-20 hover:scale-110 transition-transform">{gameState.centerCount}</div>
                        </div>

                        {/* Indicator Tile */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest bg-black/20 px-2 rounded">Gösterge</span>
                            <div className="shadow-2xl hover:scale-110 transition-transform">
                                <Tile {...gameState.indicator} size="md" />
                            </div>
                        </div>
                    </div>

                    {/* DISCARDS */}
                    {/* Left (Source) */}
                    <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                        <div onClick={() => isMyTurn && handleAction('DRAW_LEFT')} className={`w-20 h-28 border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${isMyTurn ? 'border-yellow-400 cursor-pointer bg-yellow-400/5 hover:bg-yellow-400/20' : 'border-white/10 opacity-50'}`}>
                            {(leftPlayer?.discards?.length || 0) > 0 ? (
                                <div className="pointer-events-none transform -rotate-2">
                                    <Tile {...leftPlayer!.discards[leftPlayer!.discards.length - 1]} size="md" />
                                </div>
                            ) : <span className="text-xl opacity-20">✋</span>}
                        </div>
                    </div>

                    {/* Right (My Target) */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                        <DroppableZone id="discard-zone" active={isMyTurn} label="ATIK" color="white">
                            {(myPlayer?.discards?.length || 0) > 0 && (
                                <div className="absolute pointer-events-none transform rotate-2">
                                    <Tile {...myPlayer!.discards[myPlayer!.discards.length - 1]} size="md" />
                                </div>
                            )}
                        </DroppableZone>
                    </div>
                </div>

                {/* --- OPPONENTS --- */}
                {/* TOP */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[80vw]">
                    <div className="flex items-center gap-4 bg-black/20 px-8 py-2 rounded-full border border-white/5 backdrop-blur-sm shadow-lg">
                        <OpponentAvatar player={topPlayer} name={topPlayer ? getPlayerName(topPlayer.id) : ""} />
                        <OpponentHandView count={topPlayer?.hand.length} />
                    </div>
                    <OpenedSetsRow sets={gameState.openedSets.filter(s => s.ownerId === topPlayer?.id)} />
                </div>

                {/* LEFT */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                    <div className="flex flex-col items-center gap-4 bg-black/20 py-8 px-2 rounded-full border border-white/5 backdrop-blur-sm shadow-lg">
                        <OpponentAvatar player={leftPlayer} name={leftPlayer ? getPlayerName(leftPlayer.id) : ""} />
                        <OpponentHandView count={leftPlayer?.hand.length} vertical />
                    </div>
                    <div className="h-[500px] w-[280px] overflow-y-auto pl-2 custom-scrollbar">
                        <OpenedSetsRow sets={gameState.openedSets.filter(s => s.ownerId === leftPlayer?.id)} vertical />
                    </div>
                </div>

                {/* RIGHT */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-4">
                    <div className="flex flex-col items-center gap-4 bg-black/20 py-8 px-2 rounded-full border border-white/5 backdrop-blur-sm shadow-lg">
                        <OpponentAvatar player={rightPlayer} name={rightPlayer ? getPlayerName(rightPlayer.id) : ""} />
                        <OpponentHandView count={rightPlayer?.hand.length} vertical />
                    </div>
                    <div className="h-[500px] w-[280px] overflow-y-auto pr-2 custom-scrollbar flex flex-col items-end">
                        <OpenedSetsRow sets={gameState.openedSets.filter(s => s.ownerId === rightPlayer?.id)} vertical />
                    </div>
                </div>


                {/* --- MY PLAYER (BOTTOM) --- */}
                <div className="absolute bottom-0 left-0 right-0 z-20">

                    {/* My Opened Sets (Played on table) */}
                    <div className="w-full flex justify-center pb-2 pointer-events-none">
                        <div className="pointer-events-auto bg-[#224433]/80 px-8 py-3 rounded-t-3xl border-t border-x border-[#396d52] shadow-2xl min-w-[600px] min-h-[100px] flex items-end justify-center">
                            <OpenedSetsRow sets={gameState.openedSets.filter(s => s.ownerId === myPlayer?.id)} />
                        </div>
                    </div>

                    {/* THE RACK container */}
                    <div className="bg-gradient-to-b from-[#5c4033] to-[#3e2723] w-full h-[220px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t-[8px] border-[#4a3228] relative">

                        {/* Controls Toolbar */}
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex gap-4 z-50">
                            {selectedTileIds.size > 0 && (
                                <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={handleCreateSet} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 border-2 border-green-400">
                                    <Icons.Package /> <span>PAKETLE</span>
                                </motion.button>
                            )}
                            {pendingSets.length > 0 && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleAction('OPEN_HAND', { sets: pendingSets.map(s => s.tiles.map(t => t.id)), type: 'series' })} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold shadow-lg border-2 border-blue-400">SERİ AÇ ({pendingSets.reduce((a, b) => a + b.points, 0)})</button>
                                    <button onClick={() => handleAction('OPEN_HAND', { sets: pendingSets.map(s => s.tiles.map(t => t.id)), type: 'pairs' })} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full font-bold shadow-lg border-2 border-purple-400">ÇİFT AÇ</button>
                                </div>
                            )}
                            <DroppableZone id="finish-zone" active={isMyTurn} label="BİTİR" color="red" small />
                        </div>

                        {/* Actual Rack Surface */}
                        <div className="w-full h-full flex flex-col justify-center px-4 pt-4 pb-2 gap-3 relative">
                            <div className="absolute inset-0 bg-[#3e2723] mix-blend-overlay opacity-50 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>

                            {/* Shelf 1 */}
                            <div className="relative h-[80px] bg-black/20 rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)] flex items-center justify-center px-2 border-b border-white/5">
                                <div className="flex gap-0.5 justify-center w-full">
                                    {rackSlots.slice(0, 21).map((t, i) => <RackSlot key={i} index={i} tile={t} isJoker={t && gameState.okeyTile && t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value} selected={t ? selectedTileIds.has(t.id) : false} toggle={() => t && setSelectedTileIds(p => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />)}
                                </div>
                            </div>

                            {/* Shelf 2 */}
                            <div className="relative h-[80px] bg-black/20 rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)] flex items-center justify-center px-2 border-b border-white/5">
                                <div className="flex gap-0.5 justify-center w-full">
                                    {rackSlots.slice(21, 42).map((t, i) => <RackSlot key={i + 21} index={i + 21} tile={t} isJoker={t && gameState.okeyTile && t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value} selected={t ? selectedTileIds.has(t.id) : false} toggle={() => t && setSelectedTileIds(p => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />)}
                                </div>
                            </div>

                            {/* Pending Drawer (Overlay) */}
                            <AnimatePresence>
                                {pendingSets.length > 0 && (
                                    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-4 right-4 bg-[#2a2a2a] text-white p-4 rounded-xl shadow-2xl border border-white/10 w-64 max-h-[180px] overflow-y-auto z-50">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-xs uppercase text-white/50">Hazır Paketler</span>
                                            <span className="font-bold text-green-400">{pendingSets.reduce((a, b) => a + b.points, 0)} P</span>
                                        </div>
                                        <div className="space-y-2">
                                            {pendingSets.map(s => (
                                                <div key={s.id} className={`bg-white/5 p-2 rounded flex justify-between items-center group relative border-l-4 ${s.valid ? 'border-green-500' : 'border-red-500'}`}>
                                                    <div className="flex scale-50 origin-left w-full h-8">
                                                        {s.tiles.map(t => <Tile key={t.id} {...t} size="sm" />)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${s.valid ? 'text-green-400' : 'text-red-400'}`}>{s.points}</span>
                                                        <button onClick={() => setPendingSets(p => p.filter(x => x.id !== s.id))} className="text-red-500 hover:text-white font-bold px-2 py-1 rounded bg-white/5 hover:bg-red-500 text-xs">Sil</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <DragOverlay dropAnimation={{ duration: 150 }}>
                    {activeDragTile && <Tile {...activeDragTile} size="md" className="shadow-[0_20px_50px_rgba(0,0,0,0.6)] scale-110 cursor-grabbing ring-2 ring-white" />}
                </DragOverlay>

                {/* GAME OVER MODAL */}
                <AnimatePresence>
                    {gameState.status === 'FINISHED' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#1e1e1e] border-2 border-white/10 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl max-w-lg w-full">
                                <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">OYUN BİTTİ</div>

                                <div className="w-full space-y-3">
                                    {roomPlayers.map((p, i) => {
                                        const gamePlayer = gameState.players.find(gp => gp.id === p.id);
                                        const isWinner = gameState.winnerId === p.id;
                                        return (
                                            <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${isWinner ? 'bg-yellow-400/10 border-yellow-400/50' : 'bg-white/5 border-white/5'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">{p.name?.[0]}</div>
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold">{p.name} {p.id === currentUser.id && "(Sen)"}</span>
                                                        {isWinner && <span className="text-xs text-yellow-400 font-bold uppercase tracking-widest">KAZANAN</span>}
                                                    </div>
                                                </div>
                                                <div className="text-xl font-mono font-bold text-white">
                                                    {gamePlayer?.score || 0} P
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-4 mt-4 w-full">
                                    <button onClick={() => window.location.href = '/'} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors">Ana Menü</button>
                                    <button onClick={() => handleAction('RESTART_GAME')} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg transition-transform hover:scale-105">Tekrar Oyna</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </DndContext>
    );
};

// --- SUB-COMPONENTS ---

const RackSlot = ({ index, tile, isJoker, selected, toggle }: any) => {
    const { setNodeRef } = useDroppable({ id: `slot-${index}` });
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
        id: tile ? `tile-${tile.id}` : `empty-${index}`,
        disabled: !tile
    });

    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

    return (
        <div ref={setNodeRef} className="w-[44px] h-[66px] relative flex items-center justify-center shrink-0">
            {/* Slot Guide */}
            {!tile && <div className="w-1 h-3 bg-white/5 rounded-full"></div>}

            {tile && (
                <div ref={setDragRef} {...listeners} {...attributes} style={style} onClick={toggle} className={`relative transition-all duration-200 ${selected ? '-translate-y-3 z-10' : ''} ${isDragging ? 'opacity-0' : ''}`}>
                    <Tile
                        {...tile}
                        size="md"
                        className={`
                            shadow-md
                            ${isJoker ? 'ring-2 ring-yellow-400 brightness-110' : ''}
                            ${selected ? 'ring-2 ring-green-400 shadow-xl' : ''}
                        `}
                    />
                </div>
            )}
        </div>
    );
};

const OpenedSetsRow = ({ sets, vertical = false }: { sets?: OpenedSet[], vertical?: boolean }) => {
    if (!sets || sets.length === 0) return null;
    return (
        <div className={`flex ${vertical ? 'flex-col items-end' : 'flex-row items-end'} gap-2 flex-wrap content-end`}>
            {sets.map(set => (
                <div key={set.id}>
                    <SetDisplay set={set} />
                </div>
            ))}
        </div>
    );
};

const SetDisplay = ({ set }: { set: OpenedSet }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `set-${set.id}` });
    return (
        <div ref={setNodeRef} className={`bg-black/40 p-1.5 rounded-lg border flex gap-[1px] shadow transition-all ${isOver ? 'bg-green-600/50 border-green-400 scale-105' : 'border-white/10 hover:bg-black/60'}`}>
            {set.tiles.map(t => <Tile key={t.id} {...t} size="sm" className="w-[24px] h-[34px] text-[10px]" />)}
        </div>
    );
};


const OpponentAvatar = ({ player, name }: { player: any, name: string }) => {
    if (!player) return <div className="w-12 h-12 rounded-full border-2 border-white/10 bg-white/5 border-dashed"></div>;
    return (
        <div className="relative">
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${player.isTurn ? 'border-yellow-400 shadow-[0_0_15px_gold]' : 'border-white/20'}`}>
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center font-bold text-white uppercase">{name?.[0] || '?'}</div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] text-white px-2 rounded-full whitespace-nowrap border border-white/10">{name}</div>
            <div className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/20 shadow">{player.score}</div>
        </div>
    );
};

const OpponentHandView = ({ count = 0, vertical = false }: { count?: number, vertical?: boolean }) => {
    // A clean "Stack" look for opponent hands instead of physically rendering 20 tiles
    return (
        <div className={`flex flex-col items-center justify-center gap-1 ${vertical ? 'w-8' : 'h-8'}`}>
            <div className="relative w-8 h-10">
                {/* Stack Layers */}
                <div className="absolute top-0 left-0 w-full h-full bg-yellow-100 rounded border border-gray-400 shadow-sm z-30"></div>
                <div className="absolute top-0.5 left-0.5 w-full h-full bg-yellow-100 rounded border border-gray-400 shadow-sm z-20"></div>
                <div className="absolute top-1 left-1 w-full h-full bg-yellow-100 rounded border border-gray-400 shadow-sm z-10"></div>
                {/* Count Badge */}
                <div className="absolute -right-2 -bottom-2 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow z-40">
                    {count}
                </div>
            </div>
        </div>
    );
};

const DroppableZone = ({ id, active, label, color, small }: any) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const baseClasses = small
        ? "w-20 h-12 rounded-full bg-red-600/20 border-red-500"
        : "w-20 h-28 rounded-lg border-2 border-dashed bg-black/10";

    const stateClasses = active
        ? (isOver ? `!bg-${color}-500 !border-${color}-200 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]` : `border-${color}-400 text-white`)
        : "opacity-30 border-gray-500 text-white/20";

    return (
        <div ref={setNodeRef} className={`${baseClasses} ${stateClasses} flex items-center justify-center transition-all duration-200 border`}>
            {small ? <span className="font-bold text-xs">{label}</span> : <span className="font-bold uppercase text-xs tracking-widest">{label}</span>}
            {small ? null : <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>}
        </div>
    );
};
