"use client";

import React, { useEffect, useState } from 'react';
import { getSocket } from '@/utils/socket';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
    useDraggable,
    DragEndEvent,
    DragStartEvent,
    MouseSensor,
    TouchSensor,
    useDndMonitor
} from '@dnd-kit/core';
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from 'framer-motion';
import { TileData } from '../types/game';
// Imports for extracted components
import { DraggableTile, Tile } from './game/DraggableTile';
import { PlayerAvatar } from './game/PlayerAvatar';
import { OpponentRack } from './game/OpponentRack';
import { Chat } from './game/Chat';
import { soundManager } from '@/utils/soundManager';
import { SoundToggle } from './game/SoundToggle';


interface GameBoardProps {
    roomCode: string;
    currentUser: { id: string; name: string };
    gameMode?: '101' | 'standard';
}

// Removed inline definition of TileData as it's now imported from '../game/types'

interface GameState {
    players: any[];
    indicator: TileData;
    okeyTile: TileData;
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED';
    winnerId?: string;
}

// Removed inline definition of DraggableTile component

export const GameBoard: React.FC<GameBoardProps> = ({ roomCode, currentUser, gameMode }) => {
    const is101Mode = gameMode === '101';
    const socket = getSocket();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playersMap, setPlayersMap] = useState<Record<string, { name: string, avatar: string }>>({});
    const [localHand, setLocalHand] = useState<TileData[]>([]); // For Drag and Drop
    // RACK LOGIC (30 Slots)
    const [rackSlots, setRackSlots] = useState<(TileData | null)[]>(Array(30).fill(null));
    const [showSideHint, setShowSideHint] = useState(false);
    const [lastTurnState, setLastTurnState] = useState(false);
    const [disconnectMsg, setDisconnectMsg] = useState<string | null>(null);

    // Unified Draw/Animation State to prevent race conditions
    const [drawStatus, setDrawStatus] = useState<{
        isPending: boolean;
        source: 'center' | 'left' | null;
        animatingTile: TileData | null;
        stage: 'revealing' | 'flying' | null;
    }>({ isPending: false, source: null, animatingTile: null, stage: null });

    const [flippedTileIds, setFlippedTileIds] = useState<Set<number>>(new Set()); // Tracks tiles that have been flipped at least once (for glow removal)
    const [flipAnimationIds, setFlipAnimationIds] = useState<Set<number>>(new Set()); // Tracks current flip animation state (toggle)

    // Discard Animation States
    const [discardingTile, setDiscardingTile] = useState<TileData | null>(null);
    const [isDiscardAnimating, setIsDiscardAnimating] = useState(false);
    const [isArranging, setIsArranging] = useState(false);

    // Auto-arrange mode cycling
    const [arrangeMode, setArrangeMode] = useState<'groups' | 'color' | 'value' | 'potential'>('groups');

    const [roomData, setRoomData] = useState<any>(null);
    const [showOkeyHint, setShowOkeyHint] = useState(false);

    // One-time Okey hint logic
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const seen = localStorage.getItem('okey_hint_seen');
        if (seen || !gameState?.okeyTile) return;

        const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);
        if (myIdx === -1) return;

        const hasOkey = gameState.players[myIdx].hand.some((t: any) =>
            t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value
        );

        if (hasOkey) {
            setShowOkeyHint(true);
            localStorage.setItem('okey_hint_seen', 'true');
            const timer = setTimeout(() => setShowOkeyHint(false), 8000);
            return () => clearTimeout(timer);
        }
    }, [gameState, currentUser.id]);

    useEffect(() => {
        socket.on('updateRoom', (data: any) => {
            setRoomData(data);
            if (data.players) {
                const pMap: Record<string, { name: string, avatar: string }> = {};
                data.players.forEach((p: any) => { pMap[p.id] = { name: p.name, avatar: p.avatar }; });
                setPlayersMap(pMap);
            }
        });

        return () => {
            socket.off('updateRoom');
        };
    }, [socket]);

    const toggleTileFlip = (id: number) => {
        setShowOkeyHint(false); // Hide hint immediately on interaction
        setFlippedTileIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Sync state to rack slots only when receiving new hand from server
    useEffect(() => {
        if (gameState) {
            const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);
            if (myIdx !== -1) {
                const serverHand = gameState.players[myIdx].hand;

                setRackSlots(prev => {
                    const currentTiles = prev.filter(t => t !== null) as TileData[];
                    const serverIds = new Set(serverHand.map((t: any) => t.id));
                    const currentIds = new Set(currentTiles.map(t => t.id));

                    const areSetsEqual = (a: any, b: any) => a.size === b.size && [...a].every((value: any) => b.has(value));

                    if (areSetsEqual(serverIds, currentIds)) {
                        return prev;
                    }

                    const newTiles = serverHand.filter((t: any) => !currentIds.has(t.id));
                    const goneTiles = currentTiles.filter(t => !serverIds.has(t.id));

                    let newSlots = [...prev];

                    // Remove tiles that are gone from server
                    if (goneTiles.length > 0) {
                        newSlots = newSlots.map(s => (s && goneTiles.find(g => g.id === s.id)) ? null : s);
                    }

                    // Handle new tiles from server
                    if (newTiles.length > 0) {
                        const tileToAnimate = newTiles[0];

                        // Case 1: DRAW_CENTER (animatingTile is null initially)
                        if (drawStatus.isPending && !drawStatus.animatingTile) {
                            setDrawStatus(prevS => ({ ...prevS, isPending: false, animatingTile: tileToAnimate, stage: 'revealing' }));

                            setTimeout(() => setDrawStatus(prevS => ({ ...prevS, stage: 'flying' })), 1600);
                            setTimeout(() => {
                                setRackSlots(currentSlots => {
                                    if (currentSlots.some(s => s?.id === tileToAnimate.id)) return currentSlots;
                                    const finalSlots = [...currentSlots];
                                    const emptyIdx = finalSlots.findIndex(s => s === null);
                                    if (emptyIdx !== -1) finalSlots[emptyIdx] = tileToAnimate;
                                    return finalSlots;
                                });
                                setDrawStatus({ isPending: false, source: null, animatingTile: null, stage: null });
                            }, 2800);
                        }
                        // Case 2: DRAW_LEFT (animatingTile is already set)
                        else if (drawStatus.isPending && drawStatus.animatingTile) {
                            // Mark as handled immediately to prevent re-triggering
                            setDrawStatus(prevS => ({ ...prevS, isPending: false }));

                            // Already has animatingTile, just wait for flight to finish and add to rack
                            setTimeout(() => {
                                setRackSlots(currentSlots => {
                                    if (currentSlots.some(s => s?.id === tileToAnimate.id)) return currentSlots;
                                    const finalSlots = [...currentSlots];
                                    const emptyIdx = finalSlots.findIndex(s => s === null);
                                    if (emptyIdx !== -1) finalSlots[emptyIdx] = tileToAnimate;
                                    return finalSlots;
                                });
                                setDrawStatus({ isPending: false, source: null, animatingTile: null, stage: null });
                            }, 2000);
                        }
                        // Case 3: Instant Sync (no animation pending)
                        else {
                            newTiles.forEach((tile: any) => {
                                // Skip if this tile is currently being animated elsewhere (safety)
                                if (drawStatus.animatingTile && drawStatus.animatingTile.id === tile.id) return;

                                const emptyIdx = newSlots.findIndex(s => s === null);
                                if (emptyIdx !== -1) newSlots[emptyIdx] = tile;
                            });
                        }
                    }

                    // Initial draw sync
                    if (serverHand.length > 0 && currentTiles.length === 0 && !drawStatus.animatingTile) {
                        const slots = Array(30).fill(null);
                        serverHand.forEach((t: any, i: number) => { if (i < 30) slots[i] = t; });
                        return slots;
                    }

                    return newSlots;
                });
            }
        }
    }, [gameState, currentUser.id, drawStatus]);

    const { t } = useLanguage();

    const [isPlayingIntro, setIsPlayingIntro] = useState(true);
    // Sequence: dealing -> revealing (Joker) -> fading -> done
    const [introStep, setIntroStep] = useState<'dealing' | 'revealing' | 'fading' | 'done'>('dealing');

    // Sensors for DnD
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );



    // Track turn change to show hint
    useEffect(() => {
        if (gameState) {
            const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);
            const isMyTurn = gameState.players[myIdx]?.isTurn;

            if (isMyTurn && !lastTurnState) {
                soundManager.play('your_turn');
                setShowSideHint(true);
                const timer = setTimeout(() => setShowSideHint(false), 5000);
                return () => clearTimeout(timer);
            }
            setLastTurnState(isMyTurn);
        }
    }, [gameState, currentUser.id, lastTurnState]);

    // Guard against unwanted refresh
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Standard for Chrome
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Intro Animation Sequence
    useEffect(() => {
        if (introStep === 'dealing') {
            soundManager.play('dealing', 0.02);
            return;
        } else if (introStep === 'revealing') {
            // Show Joker reveal for 4 seconds (balanced - not too fast, not too slow)
            const timer = setTimeout(() => {
                setIntroStep('fading');
                setTimeout(() => {
                    setIntroStep('done');
                    setIsPlayingIntro(false);
                }, 1000); // Fade out duration
            }, 3000); // 3 seconds to see the Joker (shortened)
            return () => clearTimeout(timer);
        }
    }, [introStep]);

    const handleLeave = () => {
        if (window.confirm(t("leave_confirm"))) {
            window.location.href = '/';
        }
    };

    // State for animations
    const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());

    useEffect(() => {
        socket.on('gameState', (state: GameState) => {
            setGameState(state);
            const myIdx = state.players.findIndex(p => p.id === currentUser.id);
            if (myIdx !== -1) {
                setLocalHand(state.players[myIdx].hand);
            }
        });

        socket.on('updateRoom', (data: any) => {
            const map: Record<string, { name: string, avatar: string }> = {};
            data.players.forEach((p: any) => map[p.id] = { name: p.name, avatar: p.avatar || "👤" });
            setPlayersMap(map);
        });

        // Handle Player Left / Disconnect for Animation
        socket.on('playerLeft', (playerId: string) => {
            setDisconnectedPlayers(prev => new Set(prev).add(playerId));

            // Show notification
            const info = playersMap[playerId];
            if (info) {
                setShowSideHint(true); // Reuse existing hint or create new one?
                // Let's create a custom temporary alert div in rendering
                setDisconnectMsg(`${info.name} oyundan ayrıldı!`);
                setTimeout(() => setDisconnectMsg(null), 3000);
            }
        });

        // Handle Joker Reveal (after dealing animation)
        socket.on('jokerRevealed', (data: { indicator: any, okeyTile: any }) => {
            console.log('[jokerRevealed] Received Joker reveal:', data);
            soundManager.play('joker_reveal', 0.5);
            // Trigger the revealing animation step
            setIntroStep('revealing');
        });

        socket.emit('getGameState');
        socket.emit('checkRoom', roomCode); // Request player info (names/avatars)

        return () => {
            socket.off('gameState');
            socket.off('updateRoom');
            socket.off('playerLeft');
            socket.off('jokerRevealed');
        };
    }, [socket, currentUser.id, roomCode]);

    const handleDragStart = () => {
        // soundManager.play('grab');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        // Play drop sound for any drag end (movement/drop)


        const { active, over } = event;

        if (!over) return;

        // Discard Handling
        if (over && over.id === 'discard-zone') {
            handleDiscard(parseInt(active.id as string));
            return;
        }

        if (over && over.id === 'finish-zone') {
            handleFinishGame(parseInt(active.id as string));
            return;
        }

        // Rack slot handling - over.id is "slot-{index}"
        if (over.id.toString().startsWith('slot-')) {
            const targetSlotIndex = parseInt(over.id.toString().split('-')[1]);

            // Find which slot the dragged tile is currently in
            const sourceSlotIndex = rackSlots.findIndex(tile => tile && tile.id.toString() === active.id.toString());

            if (sourceSlotIndex !== -1 && targetSlotIndex !== -1 && sourceSlotIndex !== targetSlotIndex) {
                setRackSlots((slots) => {
                    const newSlots = [...slots];
                    const sourceTile = newSlots[sourceSlotIndex];
                    const targetTile = newSlots[targetSlotIndex];

                    // Swap tiles
                    newSlots[sourceSlotIndex] = targetTile;
                    newSlots[targetSlotIndex] = sourceTile;
                    return newSlots;
                });
            }
        }
    };

    // Droppable component for Discard Zone
    const DiscardDroppable = () => {
        const { setNodeRef } = useDroppable({ id: 'discard-zone' });
        return <div ref={setNodeRef} className="absolute inset-0 z-50 cursor-pointer" />;
    };

    const WinnerOverlay = () => {
        if (!gameState?.winnerId || gameState.status !== 'FINISHED') return null;

        const isWinner = gameState.winnerId === currentUser.id;
        useEffect(() => {
            if (isWinner) soundManager.play('win');
            else soundManager.play('lose');
        }, []);

        const winner = roomData?.players?.find((p: any) => p.id === gameState.winnerId);
        if (!winner) return null;

        const readyCount = roomData?.restartCount || 0;
        const totalCount = roomData?.players?.length || 4;
        const isReady = roomData?.players?.find((p: any) => p.id === currentUser.id)?.readyToRestart;

        return (
            <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-700">
                {/* Celebratory Background Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                opacity: Math.random()
                            }}
                        ></div>
                    ))}
                </div>

                <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/20 p-12 rounded-[3rem] text-center shadow-[0_0_100px_rgba(234,179,8,0.3)] max-w-xl w-full mx-4 backdrop-blur-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition-colors pointer-events-none"></div>

                    {/* Winner Badge */}
                    <div className="relative mb-8 flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full bg-yellow-400 p-1 shadow-[0_0_50px_rgba(234,179,8,0.5)] relative z-10 transition-transform group-hover:scale-110 duration-500">
                            <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center text-7xl">
                                {winner.avatar}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black w-10 h-10 rounded-full flex items-center justify-center text-2xl font-black border-4 border-white">
                                👑
                            </div>
                        </div>
                    </div>

                    <h1 className="text-5xl font-black mb-2 text-white uppercase tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                        {winner.id === currentUser.id ? "TABRİKLER!" : "OYUN BİTTİ"}
                    </h1>
                    <p className="text-2xl mb-8 text-yellow-400 font-bold uppercase tracking-widest">
                        {winner.name} KAZANDI!
                    </p>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    soundManager.play('click');
                                    if (typeof window !== 'undefined') window.location.href = '/';
                                }}
                                className="group relative bg-white/5 hover:bg-white/10 text-white/50 hover:text-white p-4 rounded-full border border-white/10 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                                title="Ana Sayfaya Dön"
                            >
                                <span className="text-3xl">↺</span>
                                <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 animate-ping scale-150"></div>
                            </button>

                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={() => { soundManager.play('click'); handleRestartVote(); }}
                                disabled={isReady}
                                className={`
                                    relative group overflow-hidden px-12 py-4 rounded-full font-black text-xl transition-all duration-300
                                    ${isReady ?
                                        (is101Mode ? 'bg-red-500/20 text-red-400 border border-red-500/50 grayscale' : 'bg-green-500/20 text-green-400 border border-green-500/50 grayscale') :
                                        (is101Mode ? 'bg-red-600 text-white hover:bg-red-500 hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(0,0,0,0.3)]' : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(0,0,0,0.3)]')
                                    }
                                `}
                            >
                                <span className="relative z-10">
                                    {isReady ? "BEKLENİYOR..." : "TEKRAR OYNA"}
                                </span>
                                {!isReady && <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>}
                            </button>
                        </div>

                        {/* Consensus Tracker */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-white/40 text-sm font-bold tracking-widest uppercase">
                                HERKES HEMFİKİR OLMALI
                            </div>
                            <div className="flex gap-2">
                                {roomData?.players?.map((p: any) => (
                                    <div
                                        key={p.id}
                                        title={p.name}
                                        className={`w-3 h-3 rounded-full border border-white/10 transition-all duration-500 ${p.readyToRestart ? (is101Mode ? 'bg-red-500 shadow-[0_0_10px_red] scale-125' : 'bg-green-500 shadow-[0_0_10px_green] scale-125') : 'bg-white/10'}`}
                                    />
                                ))}
                            </div>
                            <div className={`text-lg font-black tabular-nums ${is101Mode ? 'text-red-400' : 'text-green-400'}`}>
                                {readyCount} / {totalCount}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const Leaderboard = () => {
        if (!roomData?.winScores || Object.keys(roomData.winScores).length === 0) return null;

        const scores = Object.entries(roomData.winScores).sort((a: any, b: any) => b[1] - a[1]);

        return (
            <div className="absolute top-4 right-4 z-40 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-2xl transition-all hover:border-white/20 group">
                <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                    <span className="text-yellow-400 text-xl">🏆</span>
                    <span className="text-white font-black text-sm uppercase tracking-widest">Skor Tablosu</span>
                </div>
                <div className="flex flex-col gap-2 min-w-[150px]">
                    {scores.map(([name, score]: any) => (
                        <div key={name} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs">
                                    {roomData.players.find((p: any) => p.name === name)?.avatar || "👤"}
                                </div>
                                <span className={`text-xs font-bold ${name === currentUser.name ? 'text-yellow-400' : 'text-white/70'}`}>{name}</span>
                            </div>
                            <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded-full">{score}</span>
                        </div>
                    ))}
                </div>
                {/* Micro animation for excitement */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-yellow-500 group-hover:w-[80%] transition-all duration-500"></div>
            </div>
        );
    };

    const FinishZone = () => {
        const { setNodeRef, isOver } = useDroppable({ id: 'finish-zone' });
        // Assuming 'isMyTurn' is available in the scope where FinishZone is rendered
        // For example, it could be derived from gameState:
        const isMyTurn = gameState?.players.find(p => p.id === currentUser.id)?.isTurn;

        if (!isMyTurn) return null;

        return (
            <div
                ref={setNodeRef}
                className={`
                    absolute top-1/2 -translate-y-1/2 right-[-260px] w-24 h-32 rounded-3xl border-4 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2
                    ${isOver ? (is101Mode ? 'bg-red-500/20 border-red-400 shadow-[0_0_30px_rgba(255,0,0,0.3)]' : 'bg-yellow-500/20 border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.3)]') : 'bg-white/5 border-white/20 hover:bg-white/10'}
                    scale-110
                `}
            >
                <div className={`text-4xl transition-transform duration-300 ${isOver ? 'scale-125 rotate-12' : ''}`}>🏆</div>
                <div className="text-[10px] font-black text-white/50 text-center uppercase tracking-tighter leading-none">
                    BİTİRMEK <br /> İÇİN BURAYA
                </div>
                {isOver && <div className={`absolute inset-0 rounded-3xl animate-ping border-4 ${is101Mode ? 'border-red-400/50' : 'border-yellow-400/50'}`}></div>}
            </div>
        );
    };

    const handleDiscard = (tileId: number) => {
        const pIdx = gameState?.players.findIndex(p => p.id === currentUser.id);
        const isTurn = pIdx !== undefined && pIdx !== -1 && gameState?.players[pIdx]?.isTurn;

        if (!isTurn || isDiscardAnimating || pIdx === undefined || pIdx === -1) return;

        // Client-side validation: Must have 15 tiles to discard
        if (gameState.players[pIdx].hand.length !== 15) {
            // For MVP, just return or show quick hint. The server would error anyway, 
            // but checking here prevents the "error" event roundtrip.
            // We can use the existing disconnectMsg state for a generic 'warning' toast 
            // but let's just trigger a sound or small UI shake if possible.
            // For now, just blocking it is enough to stop the crash.
            soundManager.play('error');
            alert("Önce taş çekmelisiniz (veya elinizde 15 taş olmalı)!");
            return;
        }

        const tile = rackSlots.find(t => t?.id === tileId);
        if (!tile) return;
        setDiscardingTile(tile);
        setIsDiscardAnimating(true);
        socket.emit("gameAction", { type: "DISCARD", payload: { tileId } });

        setTimeout(() => {
            setDiscardingTile(null);
            setIsDiscardAnimating(false);
        }, 800); // 0.8s for discard flight
    };

    const handleFlipTile = (tileId: number) => {
        soundManager.play('grab');

        // Mark as flipped at least once (for glow removal) - never remove
        setFlippedTileIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tileId);
            return newSet;
        });

        // Toggle flip animation state (for visual flip)
        setFlipAnimationIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tileId)) {
                newSet.delete(tileId);
            } else {
                newSet.add(tileId);
            }
            return newSet;
        });
    };


    const handleDrawCenter = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const pIdx = gameState?.players.findIndex(p => p.id === currentUser.id);
        const player = pIdx !== undefined && pIdx !== -1 ? gameState?.players[pIdx] : null;
        const isTurn = player?.isTurn;

        if (!isTurn || drawStatus.isPending || gameState?.centerCount === 0 || !player || player.hand.length >= 15) return;
        setDrawStatus({ isPending: true, source: 'center', animatingTile: null, stage: 'revealing' });
        socket.emit("gameAction", { type: "DRAW_CENTER" });
    };

    const handleDrawLeft = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const pIdx = gameState?.players.findIndex(p => p.id === currentUser.id);
        const player = pIdx !== undefined && pIdx !== -1 ? gameState?.players[pIdx] : null;
        const isTurn = player?.isTurn;

        if (!isTurn || drawStatus.isPending || !gameState || !player || player.hand.length >= 15 || pIdx === undefined) return;
        const leftPlayerIndex = (pIdx - 1 + gameState.players.length) % gameState.players.length;
        if (gameState.players[leftPlayerIndex].discards.length === 0) return;
        const tileToTake = gameState.players[leftPlayerIndex].discards.slice(-1)[0];
        setDrawStatus({ isPending: true, source: 'left', animatingTile: tileToTake, stage: 'flying' });
        socket.emit("gameAction", { type: "DRAW_LEFT" });
    };

    const handleFinishGame = (tileId: number) => {
        socket.emit('gameAction', { type: 'FINISH_GAME', payload: { tileId } });
    };

    const handleRestartVote = () => {
        socket.emit('restartVote');
    };

    const handleAutoArrange = () => {
        if (isArranging) return;
        soundManager.play('click');
        setIsArranging(true);
        setTimeout(() => setIsArranging(false), 1000);

        // Cycle to next mode
        const modes: ('groups' | 'color' | 'value' | 'potential')[] = ['groups', 'color', 'value', 'potential'];
        const currentIndex = modes.indexOf(arrangeMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setArrangeMode(nextMode);

        const allTiles = rackSlots.filter(t => t !== null) as TileData[];
        if (allTiles.length === 0) return;

        // Separate tiles
        const okeyTiles = allTiles.filter(t => gameState?.okeyTile && t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value);
        const fakeJokers = allTiles.filter(t => t.color === 'fake');
        const normalTiles = allTiles.filter(t => {
            const isOkey = gameState?.okeyTile && t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value;
            return !isOkey && t.color !== 'fake';
        });

        let newSlots: (TileData | null)[] = Array(30).fill(null);

        switch (nextMode) {
            case 'groups':
                newSlots = arrangeByGroups(normalTiles, okeyTiles, fakeJokers);
                break;
            case 'color':
                newSlots = arrangeByColor(normalTiles, okeyTiles, fakeJokers);
                break;
            case 'value':
                newSlots = arrangeByValue(normalTiles, okeyTiles, fakeJokers);
                break;
            case 'potential':
                newSlots = arrangeByPotential(normalTiles, okeyTiles, fakeJokers);
                break;
        }

        setRackSlots(newSlots);
    };

    // Mode 1: Arrange by Groups (Runs + Sets)
    const arrangeByGroups = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
        let remainingTiles = [...normalTiles];
        const groups: TileData[][] = [];
        let newSlots: (TileData | null)[] = Array(30).fill(null);

        // Find Runs (Sequential, same color)
        const colors: ('red' | 'black' | 'blue' | 'yellow')[] = ['red', 'black', 'blue', 'yellow'];
        colors.forEach(color => {
            let colorTiles = remainingTiles.filter(t => t.color === color).sort((a, b) => a.value - b.value);

            // Optimized run finding
            if (colorTiles.length < 3) return;

            let currentRun: TileData[] = [];

            for (let i = 0; i < colorTiles.length; i++) {
                const tile = colorTiles[i];
                if (currentRun.length === 0) {
                    currentRun.push(tile);
                } else {
                    const last = currentRun[currentRun.length - 1];
                    if (tile.value === last.value + 1) {
                        currentRun.push(tile);
                    } else if (tile.value === last.value) {
                        // Duplicate value, ignore for this run
                    } else {
                        // Gap found
                        if (currentRun.length >= 3) {
                            groups.push([...currentRun]);
                            // Remove from remaining
                            const ids = new Set(currentRun.map(t => t.id));
                            remainingTiles = remainingTiles.filter(t => !ids.has(t.id));
                            // Update colorTiles for next iteration
                            colorTiles = remainingTiles.filter(t => t.color === color).sort((a, b) => a.value - b.value);
                            // Restart loop to be safe or just continue? 
                            // Restarting loop is safer to re-evaluate remaining tiles
                            i = -1;
                            currentRun = [];
                        } else {
                            currentRun = [tile];
                        }
                    }
                }
            }
            // Check final run
            if (currentRun.length >= 3) {
                groups.push([...currentRun]);
                const ids = new Set(currentRun.map(t => t.id));
                remainingTiles = remainingTiles.filter(t => !ids.has(t.id));
            }

            // 13-1 Wrap Check (Special Case) - simplifying for MVP to avoid complexity bugs
        });

        // Find Sets (Same number, different colors)
        const values = Array.from(new Set(remainingTiles.map(t => t.value))).sort((a, b) => a - b);
        values.forEach(val => {
            // Re-filter to ensure we only look at what's actually remaining
            const valTiles = remainingTiles.filter(t => t.value === val);
            const uniqueColorTiles: TileData[] = [];
            const seenColors = new Set();

            valTiles.forEach(t => {
                if (!seenColors.has(t.color)) {
                    seenColors.add(t.color);
                    uniqueColorTiles.push(t);
                }
            });

            if (uniqueColorTiles.length >= 3) {
                // Prioritize sets of 4, then 3
                groups.push(uniqueColorTiles);
                const usedIds = new Set(uniqueColorTiles.map(t => t.id));
                remainingTiles = remainingTiles.filter(t => !usedIds.has(t.id));
            }
        });

        // --- PLACEMENT logic with SAFETY ---
        let cursor = 0;

        // 1. Place Groups
        groups.forEach(group => {
            if (cursor + group.length <= 30) {
                group.forEach((t, i) => newSlots[cursor + i] = t);
                cursor += group.length;
                if (cursor < 30) cursor++; // Spacer
            } else {
                // If no space with spacer, try without spacer logic later or just push to leftovers
                // For now, treat as leftovers if they don't fit
                remainingTiles.push(...group);
            }
        });

        // 2. Place Jokers (Okey + Fake)
        const allJokers = [...okeyTiles, ...fakeJokers];
        allJokers.forEach(joker => {
            if (cursor < 30) {
                newSlots[cursor] = joker;
                cursor++;
            } else {
                // Force fit search
                const empty = newSlots.indexOf(null);
                if (empty !== -1) newSlots[empty] = joker;
            }
        });

        // 3. Place Remaining Normal Tiles
        remainingTiles.sort((a, b) => a.color.localeCompare(b.color) || a.value - b.value).forEach(t => {
            // Try cursor first
            if (cursor < 30 && newSlots[cursor] === null) {
                newSlots[cursor] = t;
                cursor++;
            } else {
                // Find ANY empty slot
                const emptyIdx = newSlots.indexOf(null);
                if (emptyIdx !== -1) {
                    newSlots[emptyIdx] = t;
                } else {
                    console.error("CRITICAL: NO SPACE FOR TILE!", t);
                    // This technically shouldn't happen if total tiles <= 30.
                }
            }
        });

        // FINAL SAFETY CHECK: Ensure input count matches output count
        const inputCount = normalTiles.length + okeyTiles.length + fakeJokers.length;
        const outputCount = newSlots.filter(t => t !== null).length;

        if (inputCount !== outputCount) {
            console.log("Auto-arrange mismatch! Fallback to simple fill.");
            // Fallback: Just dump everything sequentially
            const all = [...normalTiles, ...okeyTiles, ...fakeJokers];
            const fallbackSlots = Array(30).fill(null);
            all.forEach((t, i) => { if (i < 30) fallbackSlots[i] = t; });
            return fallbackSlots;
        }

        return newSlots;
    };

    // Mode 2: Arrange by Color
    const arrangeByColor = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
        const newSlots: (TileData | null)[] = Array(30).fill(null);
        const colors: ('red' | 'black' | 'blue' | 'yellow')[] = ['red', 'black', 'blue', 'yellow'];

        let cursor = 0;
        colors.forEach(color => {
            const colorTiles = normalTiles.filter(t => t.color === color).sort((a, b) => a.value - b.value);
            colorTiles.forEach(tile => {
                if (cursor < 30) {
                    newSlots[cursor] = tile;
                    cursor++;
                }
            });
            if (colorTiles.length > 0 && cursor < 30) cursor++; // Gap between colors
        });

        // Add Jokers at end
        [...okeyTiles, ...fakeJokers].forEach(joker => {
            if (cursor < 30) {
                newSlots[cursor] = joker;
                cursor++;
            }
        });

        return newSlots;
    };

    // Mode 3: Arrange by Value
    const arrangeByValue = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
        const newSlots: (TileData | null)[] = Array(30).fill(null);
        const values = Array.from(new Set(normalTiles.map(t => t.value))).sort((a, b) => a - b);

        let cursor = 0;
        values.forEach(val => {
            const valueTiles = normalTiles.filter(t => t.value === val).sort((a, b) => a.color.localeCompare(b.color));
            valueTiles.forEach(tile => {
                if (cursor < 30) {
                    newSlots[cursor] = tile;
                    cursor++;
                }
            });
            if (valueTiles.length > 0 && cursor < 30) cursor++; // Gap between values
        });

        // Add Jokers at end
        [...okeyTiles, ...fakeJokers].forEach(joker => {
            if (cursor < 30) {
                newSlots[cursor] = joker;
                cursor++;
            }
        });

        return newSlots;
    };

    // Mode 4: Arrange by Potential (Near-complete groups)
    const arrangeByPotential = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
        const newSlots: (TileData | null)[] = Array(30).fill(null);
        let cursor = 0;

        // Create copies to avoid mutation
        const availableOkeys = [...okeyTiles];
        const availableFakes = [...fakeJokers];

        // Find pairs and near-runs
        const pairs: TileData[][] = [];
        const nearRuns: TileData[][] = [];

        // Find pairs (same value, 2 different colors)
        const values = Array.from(new Set(normalTiles.map(t => t.value)));
        values.forEach(val => {
            const valTiles = normalTiles.filter(t => t.value === val);
            if (valTiles.length === 2) {
                const uniqueColors = new Set(valTiles.map(t => t.color));
                if (uniqueColors.size === 2) {
                    pairs.push(valTiles);
                }
            }
        });

        // Find near-runs (2 sequential tiles of same color)
        const colors: ('red' | 'black' | 'blue' | 'yellow')[] = ['red', 'black', 'blue', 'yellow'];
        colors.forEach(color => {
            const colorTiles = normalTiles.filter(t => t.color === color).sort((a, b) => a.value - b.value);
            for (let i = 0; i < colorTiles.length - 1; i++) {
                if (colorTiles[i + 1].value === colorTiles[i].value + 1) {
                    nearRuns.push([colorTiles[i], colorTiles[i + 1]]);
                }
            }
        });

        // Place pairs first
        pairs.forEach(pair => {
            if (cursor + pair.length + 1 <= 30) {
                pair.forEach((t, i) => {
                    newSlots[cursor + i] = t;
                });
                // Place Joker next to pair if available
                if (availableOkeys.length > 0 && cursor + pair.length < 30) {
                    newSlots[cursor + pair.length] = availableOkeys.shift()!;
                    cursor += pair.length + 2;
                } else {
                    cursor += pair.length + 1;
                }
            }
        });

        // Place near-runs
        nearRuns.forEach(run => {
            if (cursor + run.length + 1 <= 30) {
                run.forEach((t, i) => {
                    newSlots[cursor + i] = t;
                });
                // Place Joker next to run if available
                if (availableOkeys.length > 0 && cursor + run.length < 30) {
                    newSlots[cursor + run.length] = availableOkeys.shift()!;
                    cursor += run.length + 2;
                } else {
                    cursor += run.length + 1;
                }
            }
        });

        // Fill remaining tiles
        const usedIds = new Set([...pairs.flat(), ...nearRuns.flat()].map(t => t.id));
        const remaining = normalTiles.filter(t => !usedIds.has(t.id));
        remaining.sort((a, b) => a.color.localeCompare(b.color) || a.value - b.value).forEach(t => {
            if (cursor < 30) {
                newSlots[cursor] = t;
                cursor++;
            }
        });

        // Add remaining Jokers (both unused Okeys and all Fakes)
        [...availableOkeys, ...availableFakes].forEach(joker => {
            if (cursor < 30) {
                newSlots[cursor] = joker;
                cursor++;
            }
        });

        return newSlots;
    };


    // Helper function to translate color names
    const getColorName = (color: string) => {
        const colorMap: Record<string, { tr: string, en: string }> = {
            'red': { tr: 'Kırmızı', en: 'Red' },
            'blue': { tr: 'Mavi', en: 'Blue' },
            'black': { tr: 'Siyah', en: 'Black' },
            'yellow': { tr: 'Sarı', en: 'Yellow' },
            'fake': { tr: 'Sahte Okey', en: 'Fake Joker' }
        };
        const lang = t('lang_code') === 'tr' ? 'tr' : 'en';
        return colorMap[color]?.[lang] || color;
    };

    if (!gameState) return <div className="h-screen bg-[#1e3a29] flex items-center justify-center text-white">{t("connecting")}</div>;

    // --- RENDER INTRO ---
    if (isPlayingIntro) {
        if (introStep !== 'done') {
            return (
                <div
                    className={`fixed inset-0 z-50 flex items-center justify-center ${is101Mode ? 'bg-[#2a0808]' : 'bg-[#0f0c29]'} overflow-hidden transition-opacity duration-1000 ease-in-out ${introStep === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    {/* Immersive Background */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 animate-pulse"></div>
                    <div className={`absolute inset-0 ${is101Mode ? 'bg-gradient-to-br from-red-900/30 via-transparent to-rose-900/30' : 'bg-gradient-to-br from-purple-900/30 via-transparent to-blue-900/30'}`}></div>

                    {/* Central Focus */}
                    <div className="relative z-10 flex flex-col items-center justify-center">

                        {/* 1. DEALING ANIMATION */}
                        {introStep === 'dealing' && (
                            <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                                {/* Animated Deck & Dealing Action */}
                                <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
                                    {/* Center Glow */}
                                    <div className={`absolute w-32 h-32 ${is101Mode ? 'bg-red-500/20' : 'bg-yellow-500/20'} rounded-full blur-[60px] animate-pulse`}></div>

                                    {/* The Deck (Center) */}
                                    <div className="relative w-24 h-32 bg-[#3e2723] rounded-lg shadow-2xl border-2 border-[#5d4037] z-20 flex items-center justify-center">
                                        <div className="w-20 h-28 bg-[#fdfcdc] opacity-10 rounded border border-white/20"></div>
                                    </div>

                                    {/* Dealing Particles */}
                                    {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className="absolute inset-0 flex items-center justify-center z-10">
                                            <div className="w-12 h-16 bg-[#fdfcdc] rounded shadow-xl border border-gray-300"
                                                style={{ animation: `dealTo${i} 1s ease-out infinite`, animationDelay: `${i * 0.15}s` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <h2 className={`text-4xl md:text-5xl font-black text-transparent bg-clip-text ${is101Mode ? 'bg-gradient-to-r from-red-200 via-red-400 to-red-200' : 'bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200'} animate-pulse tracking-wider`}>
                                    Taşlar Dağıtılıyor...
                                </h2>
                            </div>
                        )}

                        {/* 2. JOKER REVEAL ANIMATION */}
                        {introStep === 'revealing' && (
                            <div className="animate-in zoom-in slide-in-from-bottom-10 duration-700 flex flex-col items-center">
                                <div className="relative w-48 h-64 mb-8 perspective-1000">
                                    {/* Card Container with Flip Animation */}
                                    <div className="w-full h-full relative preserve-3d animate-[flipReveal_1.5s_ease-out_forwards]">

                                        {/* FRONT (Shows the Joker Tile) - Initially hidden */}
                                        <div className={`absolute inset-0 backface-hidden flex items-center justify-center rounded-xl ${is101Mode ? 'shadow-[0_0_50px_rgba(255,0,0,0.6)] bg-gradient-to-br from-red-100 to-red-50 border-4 border-red-500' : 'shadow-[0_0_50px_rgba(255,215,0,0.6)] bg-gradient-to-br from-yellow-100 to-yellow-50 border-4 border-yellow-500'}`} style={{ transform: 'rotateY(180deg)' }}>
                                            {/* Huge Tile Render */}
                                            <div className="scale-150">
                                                <Tile {...gameState.indicator} size="lg" />
                                            </div>

                                            {/* Shine Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none animate-[shimmer_2s_infinite]"></div>
                                        </div>

                                        {/* BACK (Deck Back) - Initially visible */}
                                        <div className="absolute inset-0 backface-hidden bg-[#3e2723] rounded-xl border-4 border-[#5d4037] flex items-center justify-center shadow-2xl">
                                            <div className="w-40 h-56 border-2 border-white/10 opacity-30 rounded-lg"></div>
                                            <div className="absolute text-6xl opacity-20">🎴</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <h3 className={`text-2xl ${is101Mode ? 'text-red-100/60' : 'text-yellow-100/60'} font-serif italic mb-2`}>Gösterge Taşı</h3>
                                    <h2 className="text-5xl font-black text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)]">
                                        {getColorName(gameState.indicator.color)} {gameState.indicator.value}
                                    </h2>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* CSS Keyframes */}
                    <style jsx>{`
                        @keyframes dealTo0 { 0% { opacity:0; transform:translateY(0) scale(0.5); } 20% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(-300px) rotate(10deg); } }
                        @keyframes dealTo1 { 0% { opacity:0; transform:translateX(0) scale(0.5); } 20% { opacity:1; transform:translateX(0) scale(1); } 100% { opacity:0; transform:translateX(300px) rotate(90deg); } }
                        @keyframes dealTo2 { 0% { opacity:0; transform:translateY(0) scale(0.5); } 20% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(300px) rotate(-10deg); } }
                        @keyframes dealTo3 { 0% { opacity:0; transform:translateX(0) scale(0.5); } 20% { opacity:1; transform:translateX(0) scale(1); } 100% { opacity:0; transform:translateX(-300px) rotate(-90deg); } }

                        @keyframes flipReveal {
                            0% { transform: rotateY(0) scale(0.5); }
                            50% { transform: rotateY(90deg) scale(1.2); }
                            100% { transform: rotateY(180deg) scale(1); }
                        }

                        @keyframes drawFlip {
                            0% { transform: rotateY(180deg) translateZ(-50px); opacity: 0.5; }
                            40% { transform: rotateY(90deg) translateZ(100px) scale(1.5); opacity: 1; }
                            100% { transform: rotateY(0deg) translateZ(0) scale(2.3); }
                        }

                        @keyframes discardFlight {
                            0% { transform: translate(-50%, 0) scale(1) rotate(0deg); opacity: 1; }
                            20% { transform: translate(0px, -50px) scale(1.1) rotate(10deg); opacity: 1; }
                            100% { transform: translate(350px, 100px) scale(0.7) rotate(180deg); opacity: 0; }
                        }

                        @keyframes shimmer {
                            0%, 100% { opacity: 0; }
                            50% { opacity: 0.3; }
                        }

                        .glass-tile-effect {
                            backdrop-filter: blur(8px);
                            background: rgba(253, 252, 220, 0.8) !important;
                            border: 1px solid rgba(255, 255, 255, 0.3) !important;
                        }

                        .preserve-3d { transform-style: preserve-3d; }
                        .backface-hidden { backface-visibility: hidden; }
                        .rotate-y-180 { transform: rotateY(180deg); }

                        /* SCATTER ANIMATIONS */
                        @keyframes scatter-0 { to { transform: translate(100px, 500px) rotate(720deg); opacity: 0; } }
                        @keyframes scatter-1 { to { transform: translate(-100px, 500px) rotate(-360deg); opacity: 0; } }
                        @keyframes scatter-2 { to { transform: translate(50px, 400px) rotate(180deg); opacity: 0; } }
                        @keyframes scatter-3 { to { transform: translate(-50px, 450px) rotate(-180deg); opacity: 0; } }

                        @keyframes rackPulse {
                            0% { transform: rotateX(5deg) scale(1); }
                            50% { transform: rotateX(10deg) scale(1.02); filter: brightness(1.2); }
                            100% { transform: rotateX(5deg) scale(1); }
                        }

                        @keyframes tilePop {
                            0% { transform: scale(0.5) translateY(20px); opacity: 0; }
                            70% { transform: scale(1.1) translateY(-5px); opacity: 1; }
                            100% { transform: scale(1) translateY(0); opacity: 1; }
                        }
                    `}</style>
                </div>
            );
        }
        return null;
    }

    const DrawAnimationOverlay = () => {
        if (!drawStatus.animatingTile || !drawStatus.stage) return null;

        const isCenter = drawStatus.source === 'center';

        return (
            <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
                <div
                    className={`
                        absolute transition-all duration-[1500ms] cubic-bezier(0.19, 1, 0.22, 1)
                        ${drawStatus.stage === 'revealing' ?
                            (isCenter ? 'left-1/2 top-[45%]' : 'left-[15%] top-[45%]') + ' -translate-x-1/2 -translate-y-1/2 scale-[2.3] z-[200]' :
                            'left-1/2 bottom-[140px] -translate-x-1/2 scale-100 z-[100]'
                        }
                    `}
                    style={{
                        perspective: '1500px'
                    }}
                >
                    <div className={`
                        relative w-14 h-20 preserve-3d transition-transform duration-[1500ms] shadow-[0_30px_60px_rgba(0,0,0,0.6)]
                        ${drawStatus.stage === 'revealing' && isCenter ? 'animate-[drawFlip_1.5s_cubic-bezier(0.23, 1, 0.32, 1)_forwards]' : ''}
                    `}>
                        {/* Front */}
                        <div className="absolute inset-0 backface-hidden">
                            <Tile {...drawStatus.animatingTile} size="lg" className="glass-tile-effect" />
                        </div>
                        {/* Back */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180">
                            <Tile isBack size="lg" className="glass-tile-effect" />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const DiscardAnimationOverlay = () => {
        if (!discardingTile || !isDiscardAnimating) return null;

        return (
            <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
                <div
                    className="absolute left-1/2 bottom-[140px] -translate-x-1/2 animate-[discardFlight_0.8s_ease-in_forwards] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                >
                    <Tile {...discardingTile} size="lg" className="glass-tile-effect" />
                </div>
            </div>
        );
    };


    // --- RENDER GAME ---
    // Helper to render opponents based on relative position
    /*
       Okey table usually:
       Bottom: Me
       Right: Player 1 (Counter-Clockwise) or 3?
       Let's stick to: Me (0), Right (1), Top (2), Left (3) relative to me
    */
    const myIndex = gameState.players.findIndex(p => p.id === currentUser.id);
    const isMyTurn = gameState.players[myIndex].isTurn;

    // Calculate relative positions
    // Calculate relative positions
    const getRelativePlayer = (offset: number) => {
        if (gameState.players.length === 2) {
            // For 2 players:
            // Me (0) vs Opponent (1)
            // We want Opponent to be "Top" (Offset 2 visually in 4-player terms)
            // But logic-wise they are index (me+1)%2.
            if (offset === 2) return gameState.players[(myIndex + 1) % 2];
            return null;
        }
        // For 4 players (Standard)
        // Me=0, Right=1, Top=2, Left=3
        return gameState.players[(myIndex + offset) % 4];
    };

    const rightPlayer = getRelativePlayer(1);
    const topPlayer = getRelativePlayer(2);
    const leftPlayer = getRelativePlayer(3);

    return (
        <div className={`fixed inset-0 select-none overflow-hidden ${is101Mode ? 'bg-[#310000]' : 'bg-[#1a3a2a]'} perspective-1000 font-sans`}>
            {/* Background Atmosphere */}
            <div className={`absolute inset-0 ${is101Mode ? 'bg-gradient-to-br from-[#4a0404] via-[#310000] to-[#1a0505]' : 'bg-gradient-to-br from-[#2d5a42] via-[#1a3a2a] to-[#0f241a]'} pointer-events-none opacity-40`}></div>
            <div className={`absolute top-0 right-0 w-[800px] h-[800px] ${is101Mode ? 'bg-red-600/10' : 'bg-green-600/10'} rounded-full blur-[120px] pointer-events-none animate-pulse`}></div>
            <div className={`absolute bottom-0 left-0 w-[800px] h-[800px] ${is101Mode ? 'bg-rose-600/10' : 'bg-emerald-600/10'} rounded-full blur-[120px] pointer-events-none animate-pulse`} style={{ animationDelay: "2s" }}></div>

            <AnimatePresence>

            </AnimatePresence>
            <DrawAnimationOverlay />
            <DiscardAnimationOverlay />
            <WinnerOverlay />
            <Leaderboard />
            {/* Chat Component */}
            <Chat socket={socket} />

            {/* Disconnect Notification */}
            {disconnectMsg && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
                    <div className="bg-red-600/90 text-white px-6 py-3 rounded-full font-bold shadow-[0_0_20px_red] backdrop-blur-md flex items-center gap-3 border border-red-400">
                        <span className="text-2xl">⚠️</span>
                        {disconnectMsg}
                    </div>
                </div>
            )}

            {/* --- ENVIRONMENT --- */}
            {/* Table Texture */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-60 mix-blend-multiply pointer-events-none"></div>
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000000_100%)] opacity-60 pointer-events-none"></div>

            {/* Room Info */}
            <div className="absolute top-4 left-4 z-50 flex gap-4 items-center">
                {/* Back Button */}
                <button
                    onClick={handleLeave}
                    className={`${is101Mode ? 'bg-red-700/80 hover:bg-red-600' : 'bg-red-600/80 hover:bg-red-600'} text-white px-4 py-2 rounded-lg font-bold shadow-lg backdrop-blur flex items-center gap-2 transition-transform hover:scale-105 active:scale-95`}
                >
                    <span>⬅</span> {t("exit")}
                </button>

                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-lg text-white/80 font-mono text-sm border border-white/10 shadow-lg">
                    Code: <span className="text-yellow-400 font-bold">{roomCode}</span>
                </div>


            </div >

            {/* Game End Overlay */}
            {/* --- OPPONENTS --- */}

            {/* TOP PLAYER */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 transition-opacity duration-500">
                {topPlayer && (
                    <>
                        <PlayerAvatar player={topPlayer} info={playersMap[topPlayer.id]} position="top" isDisconnected={disconnectedPlayers.has(topPlayer.id)} />
                        <OpponentRack player={topPlayer} position="top" isDisconnected={disconnectedPlayers.has(topPlayer.id)} />
                    </>
                )}
            </div>

            {/* LEFT PLAYER */}
            <div className="absolute left-[15%] top-1/2 -translate-y-1/2 z-10 flex flex-row items-center gap-6">
                {leftPlayer && (
                    <div className="flex flex-col items-center gap-4">
                        <PlayerAvatar player={leftPlayer} info={playersMap[leftPlayer.id]} position="left" isDisconnected={disconnectedPlayers.has(leftPlayer.id)} />
                        <div className="rotate-0 ml-0"> {/* Container tweak for vertical alignment */}
                            <OpponentRack player={leftPlayer} position="left" isDisconnected={disconnectedPlayers.has(leftPlayer.id)} />
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT PLAYER */}
            <div className="absolute right-[15%] top-1/2 -translate-y-1/2 z-10 flex flex-row-reverse items-center gap-6">
                {rightPlayer && (
                    <div className="flex flex-col items-center gap-4">
                        <PlayerAvatar player={rightPlayer} info={playersMap[rightPlayer.id]} position="right" isDisconnected={disconnectedPlayers.has(rightPlayer.id)} />
                        <div className="rotate-0 mr-0">
                            <OpponentRack player={rightPlayer} position="right" isDisconnected={disconnectedPlayers.has(rightPlayer.id)} />
                        </div>
                    </div>
                )}
            </div>

            {/* --- CENTER TABLE AREA --- */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] z-0">
                {/* Felt Zone Glow */}
                <div className="absolute inset-0 bg-white/5 rounded-[50px] blur-3xl pointer-events-none"></div>

                {/* DECK (Left Center-ish) */}
                <div
                    onClick={isMyTurn && gameState.centerCount > 0 && gameState.players[myIndex].hand.length < 15 ? handleDrawCenter : undefined}
                    className={`
                        absolute left-[35%] top-1/2 -translate-y-1/2 -translate-x-1/2
                        w-24 h-32 bg-[#3e2723] rounded-sm transform rotate-[-5deg]
                        shadow-[5px_5px_15px_rgba(0,0,0,0.5)]
                        flex items-center justify-center transition-all duration-300 group
                        ${isMyTurn && gameState.players[myIndex].hand.length < 15 ? (is101Mode ? 'hover:-translate-y-2 hover:rotate-0 cursor-pointer ring-2 ring-red-400' : 'hover:-translate-y-2 hover:rotate-0 cursor-pointer ring-2 ring-yellow-400') : ''}
                    `}>
                    {/* Deck Top Card (Back) */}
                    <div className="w-20 h-28 bg-[#fdfcdc] rounded-[2px] border border-[#d7ccc8] flex items-center justify-center">
                        <div className="w-14 h-20 border-2 border-[#8d6e63] opacity-20"></div>
                    </div>

                    {/* Count Badge */}
                    <div className={`absolute -top-3 -right-3 ${is101Mode ? 'bg-red-600' : 'bg-red-600'} text-white font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-white`}>
                        {gameState.centerCount}
                    </div>
                </div>

                {/* INDICATOR (Center Right) */}
                <div className="absolute left-[60%] top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group">
                    <div className="flex flex-col items-center">
                        <Tile {...gameState.indicator} size="md" className="rotate-3 shadow-2xl group-hover:rotate-0 transition-transform duration-500" />
                    </div>
                </div>



                {/* --- DISCARDS (Dynamic Layout) --- */}

                {/* 1. LEFT ZONE (Draw Source) - Always visible (My Left) */}
                {/* In 2-player: This is Opponent's discard (Index: me-1) */}
                {/* In 4-player: This is Left Player's discard (Index: me-1) */}
                <div className={`absolute left-4 flex flex-col items-center group transition-all duration-500 ${gameState.players.length === 2 ? 'bottom-40' : 'bottom-4'}`}>
                    <div className="text-[10px] text-white/30 font-bold mb-1 uppercase tracking-tighter italic">SOL TARAF (AL)</div>
                    <div className="w-14 h-20 flex items-center justify-center relative">
                        {gameState.players[(myIndex - 1 + gameState.players.length) % gameState.players.length]?.discards.length > 0 ? (
                            <div
                                className={`relative group transition-all duration-300 ${isMyTurn && gameState.players[myIndex].hand.length < 15 ? 'hover:scale-110 active:scale-95 cursor-pointer' : ''}`}
                                onClick={isMyTurn && gameState.players[myIndex].hand.length < 15 ? handleDrawLeft : undefined}
                            >
                                <div className={`transition-all duration-300 ${isMyTurn && gameState.players[myIndex].hand.length < 15 ? (is101Mode ? 'ring-4 ring-red-500 shadow-[0_0_30px_red] rounded' : 'ring-4 ring-blue-500 shadow-[0_0_30px_blue] rounded') : ''}`}>
                                    <Tile
                                        {...gameState.players[(myIndex - 1 + gameState.players.length) % gameState.players.length].discards.slice(-1)[0]}
                                        size="md"
                                        className="shadow-lg"
                                    />
                                </div>
                                {isMyTurn && (
                                    <div className={`absolute -top-12 left-1/2 -translate-x-1/2 ${is101Mode ? 'bg-red-600' : 'bg-blue-600'} text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-xl border border-white/20 transition-all duration-500 animate-bounce ${showSideHint ? 'opacity-100' : 'opacity-0'}`}>
                                        BURADAN AL
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-14 h-20 border-2 border-dashed border-white/5 rounded-sm flex items-center justify-center text-white/5 text-[8px] font-bold uppercase tracking-widest bg-black/5">BOŞ</div>
                        )}
                    </div>
                </div>

                {/* 2. RIGHT ZONE (My Target) - Always visible (My Right) */}
                <div className={`absolute right-4 flex flex-col items-center transition-all duration-500 ${gameState.players.length === 2 ? 'bottom-40' : 'bottom-4'}`}>
                    <div className="text-[10px] text-white/30 font-bold mb-1 uppercase tracking-tighter italic">SAĞ TARAF (AT)</div>
                    <div className="w-14 h-20 flex items-center justify-center relative">
                        {isMyTurn && <DiscardDroppable />}
                        {gameState.players[myIndex].discards.length > 0 ? (
                            <Tile
                                {...gameState.players[myIndex].discards[gameState.players[myIndex].discards.length - 1]}
                                size="md"
                                className="shadow-lg opacity-80"
                            />
                        ) : (
                            <div className="w-14 h-20 border-2 border-dashed border-white/10 rounded-sm flex items-center justify-center text-white/10 text-[8px] font-bold uppercase tracking-widest bg-black/5">ATILAN</div>
                        )}
                    </div>
                </div>

                {/* 3. OTHER ZONES - Only for 4 Players */}
                {gameState.players.length === 4 && (
                    <>
                        {/* RIGHT PLAYER DISCARD - Top Right */}
                        <div className="absolute right-4 top-4 flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity">
                            <div className="w-14 h-20 flex items-center justify-center relative">
                                {gameState.players[(myIndex + 1) % gameState.players.length]?.discards.length > 0 ? (
                                    <Tile
                                        {...gameState.players[(myIndex + 1) % gameState.players.length].discards.slice(-1)[0]}
                                        size="md"
                                        className="shadow-md"
                                    />
                                ) : (
                                    <div className="w-14 h-20 border border-white/5 rounded-sm bg-black/10"></div>
                                )}
                            </div>
                        </div>

                        {/* TOP PLAYER DISCARD - Top Left */}
                        <div className="absolute left-4 top-4 flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity">
                            <div className="w-14 h-20 flex items-center justify-center relative">
                                {gameState.players[(myIndex + 2) % gameState.players.length]?.discards.length > 0 ? (
                                    <Tile
                                        {...gameState.players[(myIndex + 2) % gameState.players.length].discards.slice(-1)[0]}
                                        size="md"
                                        className="shadow-md"
                                    />
                                ) : (
                                    <div className="w-14 h-20 border border-white/5 rounded-sm bg-black/10"></div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* --- MY RACK (Main Interaction) --- */}
            <div className="absolute bottom-0 left-0 w-full h-[250px] flex justify-center items-end pb-0 z-30 perspective-1000">
                <div className={`
                    relative bg-[#3e2723] w-full max-w-[95%] md:max-w-[1100px] h-[160px] rounded-t-lg shadow-[0_-20px_60px_rgba(0,0,0,0.8)] border-t-[8px] border-[#5d4037] flex items-center justify-center pb-4 transform rotateX(5deg) origin-bottom transition-all duration-300 hover:rotateX(0deg)
                    ${isMyTurn ? 'ring-4 ring-yellow-400 shadow-[0_-20px_80px_rgba(255,215,0,0.4)]' : ''}
                    ${isArranging ? 'animate-[rackPulse_0.5s_ease-in-out]' : ''}
                `}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30 mix-blend-overlay pointer-events-none"></div>

                    {/* Auto-Arrange Button */}
                    <button
                        onClick={handleAutoArrange}
                        title="Otomatik Diz (Per)"
                        className={`absolute -top-14 right-4 ${is101Mode ? 'bg-red-600/80 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-yellow-500/80 hover:bg-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.4)]'} text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl backdrop-blur border border-white/20 transition-all hover:scale-110 active:scale-90 z-[60]`}
                    >
                        💡
                    </button>



                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {isMyTurn && (
                            <div
                                id="discard-zone-container"
                                className="absolute -top-[500px] right-[5%] w-64 h-80 border-4 border-dashed border-red-500/30 rounded-3xl bg-red-500/5 flex flex-col items-center justify-center z-50 transition-all hover:bg-red-500/20 hover:scale-105 hover:border-red-500 group animate-pulse"
                            >
                                <div className="text-red-300 font-black text-6xl mb-4 group-hover:scale-125 transition-transform duration-300">🗑️</div>
                                <div className="text-red-200 font-black text-center text-xl tracking-widest">TAŞI AT</div>
                                <DiscardDroppable />
                            </div>
                        )}

                        <div className="grid grid-rows-2 grid-cols-15 gap-x-3 gap-y-2 px-6 relative">
                            {/* Finish Zone on the Right */}
                            <FinishZone />

                            {rackSlots.map((tile, i) => (
                                <DroppableSlot key={i} id={`slot-${i}`}>
                                    {tile ? (
                                        <div className="animate-[tilePop_0.3s_ease-out_forwards]">
                                            <DraggableTile
                                                tile={tile}
                                                isMyTurn={isMyTurn}
                                                onDiscard={handleDiscard}
                                                isOkey={gameState.okeyTile && tile.color === gameState.okeyTile.color && tile.value === gameState.okeyTile.value}
                                                onFlip={handleFlipTile}
                                                isFlipped={flipAnimationIds.has(tile.id)}
                                                hasBeenFlipped={flippedTileIds.has(tile.id)}
                                            />
                                        </div>
                                    ) : null}
                                </DroppableSlot>
                            ))}
                        </div>
                    </DndContext>
                </div>
            </div>
        </div>
    );
};

// Droppable Slot Component
const DroppableSlot = ({ id, children }: { id: string, children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`w-10 h-14 md:w-12 md:h-20 border-2 border-dashed border-white/5 bg-black/10 rounded flex items-center justify-center transition-colors ${isOver ? 'bg-white/20 border-yellow-400' : 'hover:border-white/20'}`}
        >
            {children}
        </div>
    );
};
