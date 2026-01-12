"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { getSocket } from '@/utils/socket';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import { useLanguage } from "@/contexts/LanguageContext";

// Modular Components
import { TileData, GameState } from './game/types';
import { PlayerRack } from './game/PlayerRack';
import { OpponentArea } from './game/OpponentArea';
import { GameTable } from './game/GameTable';
import { Leaderboard } from './game/Leaderboard';
import { WinnerOverlay } from './game/WinnerOverlay';
import { Tile } from './Tile';

interface GameBoardProps {
    roomCode: string;
    currentUser: { id: string; name: string };
}

export const GameBoard: React.FC<GameBoardProps> = ({ roomCode, currentUser }) => {
    const socket = getSocket();
    const { t } = useLanguage();

    const [gameState, setGameState] = useState<GameState | null>(null);
    const [roomData, setRoomData] = useState<any>(null);
    const [playersMap, setPlayersMap] = useState<Record<string, { name: string, avatar: string }>>({});
    const [rackSlots, setRackSlots] = useState<(TileData | null)[]>(Array(30).fill(null));
    const [flippedTileIds, setFlippedTileIds] = useState<Set<number>>(new Set());
    const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());

    // Animation States
    const [drawStatus, setDrawStatus] = useState<{
        isPending: boolean;
        source: 'center' | 'left' | null;
        animatingTile: TileData | null;
        stage: 'revealing' | 'flying' | null;
    }>({ isPending: false, source: null, animatingTile: null, stage: null });

    const [isArranging, setIsArranging] = useState(false);
    const [showOkeyHint, setShowOkeyHint] = useState(false);
    const [isPlayingIntro, setIsPlayingIntro] = useState(true);
    const [introStep, setIntroStep] = useState<'dealing' | 'revealing' | 'fading' | 'done'>('dealing');

    // Sensors for DnD
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    // Initial Room & Game State
    useEffect(() => {
        socket.on('gameState', (state: GameState) => {
            setGameState(state);
        });

        socket.on('updateRoom', (data: any) => {
            setRoomData(data);
            if (data.players) {
                const map: Record<string, { name: string, avatar: string }> = {};
                data.players.forEach((p: any) => map[p.id] = { name: p.name, avatar: p.avatar || "👤" });
                setPlayersMap(map);
            }
        });

        socket.on('playerLeft', (playerId: string) => {
            setDisconnectedPlayers(prev => new Set(prev).add(playerId));
        });

        socket.on('jokerRevealed', () => {
            setIntroStep('revealing');
        });

        socket.emit('getGameState');
        socket.emit('checkRoom', roomCode);

        return () => {
            socket.off('gameState');
            socket.off('updateRoom');
            socket.off('playerLeft');
            socket.off('jokerRevealed');
        };
    }, [socket, roomCode]);

    // Rack Sync Logic
    useEffect(() => {
        if (!gameState) return;
        const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);
        if (myIdx === -1) return;

        const serverHand = gameState.players[myIdx].hand;

        setRackSlots(prev => {
            const currentTiles = prev.filter(t => t !== null) as TileData[];
            const serverIds = new Set(serverHand.map(t => t.id));
            const currentIds = new Set(currentTiles.map(t => t.id));

            if (drawStatus.animatingTile) currentIds.add(drawStatus.animatingTile.id);

            // If equal, do nothing
            if (serverIds.size === currentIds.size && [...serverIds].every(id => currentIds.has(id))) return prev;

            const newTiles = serverHand.filter(t => !currentIds.has(t.id));
            const goneTiles = currentTiles.filter(t => !serverIds.has(t.id));

            let newSlots = [...prev];

            // Remove gone
            if (goneTiles.length > 0) {
                newSlots = newSlots.map(s => (s && goneTiles.some(g => g.id === s.id)) ? null : s);
            }

            // Handle Draw Animation or Instant Sync
            if (newTiles.length > 0) {
                if (drawStatus.isPending && !drawStatus.animatingTile) {
                    const tileToAnimate = newTiles[0];
                    startDrawAnimation(tileToAnimate);

                    // Add bulk rest (if any)
                    newTiles.slice(1).forEach(tile => {
                        const emptyIdx = newSlots.findIndex(s => s === null);
                        if (emptyIdx !== -1) newSlots[emptyIdx] = tile;
                    });
                } else if (!drawStatus.isPending && !drawStatus.animatingTile) {
                    newTiles.forEach(tile => {
                        const emptyIdx = newSlots.findIndex(s => s === null);
                        if (emptyIdx !== -1) newSlots[emptyIdx] = tile;
                    });
                }
            }

            // Initial Draw
            if (serverHand.length > 0 && currentTiles.length === 0 && !drawStatus.animatingTile) {
                const slots = Array(30).fill(null);
                serverHand.forEach((t, i) => { if (i < 30) slots[i] = t; });
                return slots;
            }

            return newSlots;
        });
    }, [gameState, currentUser.id, drawStatus]);

    const startDrawAnimation = (tile: TileData) => {
        setDrawStatus(prev => ({ ...prev, isPending: false, animatingTile: tile, stage: 'revealing' }));
        const isCenter = drawStatus.source === 'center';

        setTimeout(() => setDrawStatus(prev => ({ ...prev, stage: 'flying' })), isCenter ? 1600 : 500);
        setTimeout(() => {
            setRackSlots(current => {
                if (current.some(s => s?.id === tile.id)) return current;
                const final = [...current];
                const empty = final.findIndex(s => s === null);
                if (empty !== -1) final[empty] = tile;
                return final;
            });
            setDrawStatus({ isPending: false, source: null, animatingTile: null, stage: null });
        }, isCenter ? 2800 : 2000);
    };

    // Actions
    const handleDiscard = (tileId: number) => {
        socket.emit('gameAction', { type: 'DISCARD', payload: { tileId } });
        // Optimistically remove from rack? No, safer to wait for server sync and let useEffect handle it.
        // For smoother feel, we could animate here.
    };

    const handleDrawCenter = () => {
        setDrawStatus({ isPending: true, source: 'center', animatingTile: null, stage: null });
        socket.emit('gameAction', { type: 'DRAW_CENTER' });
    };

    const handleDrawLeft = () => {
        setDrawStatus({ isPending: true, source: 'left', animatingTile: null, stage: null });
        socket.emit('gameAction', { type: 'DRAW_LEFT' });
    };

    const handleFinishGame = (tileId: number) => {
        socket.emit('gameAction', { type: 'FINISH_GAME', payload: { tileId } });
    };

    const handleShowIndicator = () => {
        socket.emit('gameAction', { type: 'SHOW_INDICATOR' });
    };

    const handleAutoArrange = () => {
        setIsArranging(true);
        setTimeout(() => setIsArranging(false), 800);

        const allTiles = rackSlots.filter(t => t !== null) as TileData[];
        if (allTiles.length === 0) return;

        // Custom arrange logic (simplified version for now)
        const sorted = [...allTiles].sort((a, b) => a.color.localeCompare(b.color) || a.value - b.value);
        const newSlots = Array(30).fill(null);
        sorted.forEach((t, i) => { if (i < 30) newSlots[i] = t; });
        setRackSlots(newSlots);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        if (over.id === 'discard-zone') {
            handleDiscard(parseInt(active.id));
            return;
        }

        if (over.id === 'finish-zone') {
            handleFinishGame(parseInt(active.id));
            return;
        }

        if (over.data.current?.type === 'opened-set') {
            const { playerId, setIndex } = over.data.current;
            socket.emit('gameAction', {
                type: 'ADD_TO_SET',
                payload: {
                    tileId: parseInt(active.id),
                    targetPlayerId: playerId,
                    setIndex: setIndex
                }
            });
            return;
        }

        if (over.id.toString().startsWith('slot-')) {
            const target = parseInt(over.id.toString().split('-')[1]);
            const source = rackSlots.findIndex(tile => tile && tile.id.toString() === active.id.toString());

            if (source !== -1 && target !== -1 && source !== target) {
                setRackSlots(prev => {
                    const next = [...prev];
                    [next[source], next[target]] = [next[target], next[source]];
                    return next;
                });
            }
        }
    };

    // Intro Control
    useEffect(() => {
        if (introStep === 'revealing') {
            const timer = setTimeout(() => {
                setIntroStep('fading');
                setTimeout(() => {
                    setIntroStep('done');
                    setIsPlayingIntro(false);
                }, 1000);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [introStep]);

    if (!gameState) {
        const mode = typeof window !== 'undefined' ? localStorage.getItem('okey_mode') : 'standard';
        return <div className={`h-screen flex items-center justify-center text-white/50 font-black tracking-widest animate-pulse transition-all duration-1000 ${mode === '101' ? 'bg-[#1a0505]' : 'bg-[#0f0c29]'}`}>BAĞLANILIYOR...</div>;
    }

    // Intro Overlay (Standalone)
    if (isPlayingIntro && introStep !== 'done') {
        const is101 = gameState.mode === '101';
        return (
            <div
                onClick={() => { setIntroStep('done'); setIsPlayingIntro(false); }}
                className={`fixed inset-0 z-[1000] flex items-center justify-center transition-opacity duration-1000 ${introStep === 'fading' ? 'opacity-0' : 'opacity-100'} ${is101 ? 'bg-[#1a0505]' : 'bg-[#0f0c29]'}`}
            >
                <div className={`absolute inset-0 backdrop-blur-3xl ${is101 ? 'bg-red-950/40' : 'bg-black/60'}`}></div>
                <div className="relative text-center">
                    {introStep === 'dealing' && (
                        <div className="flex flex-col items-center gap-8">
                            <div className={`w-24 h-32 rounded-lg border-2 animate-pulse flex items-center justify-center text-4xl ${is101 ? 'bg-red-900/20 border-red-500/50' : 'bg-white/10 border-white/20'}`}>
                                {is101 ? "🔥" : "🎴"}
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-[0.5em]">
                                {is101 ? "V O İ D   D A Ğ I T I L I Y O R" : "Taşlar Dağıtılıyor"}
                            </h2>
                        </div>
                    )}
                    {introStep === 'revealing' && (
                        <div className="flex flex-col items-center gap-12 animate-in zoom-in duration-1000">
                            <div className="text-white/40 uppercase tracking-[1em] text-xs">GÖSTERGE BELİRLENDİ</div>
                            <div className={`scale-[2.5] shadow-[0_0_100px_rgba(255,255,255,0.2)] ${is101 ? 'ring-4 ring-red-600' : ''}`}>
                                <Tile {...gameState.indicator} size="lg" />
                            </div>
                            <div className="mt-8 flex flex-col gap-2">
                                <div className={`${is101 ? 'text-red-500' : 'text-yellow-400'} font-black text-4xl uppercase tracking-tighter`}>OKEY: {gameState.okeyTile.value} {t(gameState.okeyTile.color)}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const myPlayer = gameState.players.find(p => p.id === currentUser.id);
    const isMyTurn = myPlayer?.isTurn || false;
    const hasIndicatorInHand = myPlayer?.hand.some(t => t.color === gameState.indicator.color && t.value === gameState.indicator.value) || false;
    const scores = roomData?.winScores ? Object.entries(roomData.winScores) : [];

    const is101 = gameState.mode === '101';

    return (
        <div className={`relative w-full h-screen overflow-hidden transition-all duration-1000 ${is101 ? 'bg-[#1a0505]' : 'bg-[#0f0c29]'}`}>
            {/* Ambient Background */}
            <div className={`absolute inset-0 mode-transition bg-gradient-to-br transition-opacity duration-1000 ${is101
                ? 'from-[#2b0303] via-[#4a0404] to-[#1a0505]'
                : 'from-[#24243e] via-[#302b63] to-[#0f0c29]'
                }`}></div>

            <div className={`absolute top-[-50%] left-[-50%] w-[200%] h-[200%] mode-transition animate-pulse-slow ${is101
                ? 'bg-[radial-gradient(circle_farthest-corner_at_center,rgba(153,27,27,0.1)_0%,transparent_50%)]'
                : 'bg-[radial-gradient(circle_farthest-corner_at_center,rgba(76,29,149,0.1)_0%,transparent_50%)]'
                }`}></div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                {/* UI Layers */}
                <Leaderboard
                    scores={scores as any}
                    players={roomData?.players || []}
                    currentUser={currentUser}
                    t={t}
                />

                <OpponentArea
                    players={gameState.players}
                    currentUser={currentUser}
                    playersMap={playersMap}
                    disconnectedPlayers={disconnectedPlayers}
                    t={t}
                />

                <GameTable
                    indicator={gameState.indicator}
                    okeyTile={gameState.okeyTile}
                    centerCount={gameState.centerCount}
                    lastDiscard={gameState.players[(gameState.turnIndex - 1 + gameState.players.length) % gameState.players.length].discards.slice(-1)[0]}
                    isMyTurn={isMyTurn}
                    mode={gameState.mode}
                    players={gameState.players}
                    currentUserId={currentUser.id}
                    onDrawCenter={handleDrawCenter}
                    onDrawLeft={handleDrawLeft}
                    onShowIndicator={handleShowIndicator}
                    hasIndicatorInHand={hasIndicatorInHand}
                    canShowIndicator={!myPlayer?.hasShownIndicator}
                />

                <PlayerRack
                    rackSlots={rackSlots}
                    isMyTurn={isMyTurn}
                    okeyTile={gameState.okeyTile}
                    mode={gameState.mode}
                    onDiscard={handleDiscard}
                    onFlip={(id) => setFlippedTileIds(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                    })}
                    flippedTileIds={flippedTileIds}
                    onAutoArrange={handleAutoArrange}
                    isArranging={isArranging}
                    showOkeyHint={showOkeyHint}
                    currentSum={is101 ? myPlayer?.sumOfOpened : undefined}
                    onOpen={() => socket.emit('gameAction', { type: 'OPEN_HAND' })}
                    t={t}
                />

                {/* Drag Overlay for smooth visuals */}
                <DragOverlay>
                    {/* Active Drag styling logic here if needed */}
                </DragOverlay>
            </DndContext>

            {/* Finish Overlay */}
            {gameState.status === 'FINISHED' && (
                <WinnerOverlay
                    winner={roomData?.players?.find((p: any) => p.id === gameState.winnerId)}
                    isReady={roomData?.players?.find((p: any) => p.id === currentUser.id)?.readyToRestart}
                    readyCount={roomData?.restartCount || 0}
                    totalCount={roomData?.players?.length || 4}
                    players={roomData?.players || []}
                    onRestart={() => socket.emit('restartVote')}
                    onHome={() => window.location.href = '/'}
                    mode={gameState.mode}
                    t={t}
                />
            )}
        </div>
    );
};
