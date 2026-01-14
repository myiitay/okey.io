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
    TouchSensor
} from '@dnd-kit/core';
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from 'framer-motion';
import { TileData, GameState } from './game/types';
import { arrangeByGroups, arrangeByColor, arrangeByValue, arrangeByPotential, getColorName, getRelativePlayer } from '../utils/gameLogics';
// Imports for extracted components
import { DraggableTile, Tile } from './game/DraggableTile';
import { PlayerAvatar } from './game/PlayerAvatar';
import { OpponentRack } from './game/OpponentRack';
import { Chat } from './game/Chat';
import { soundManager } from '@/utils/soundManager';
import { SoundToggle } from './game/SoundToggle';
import { WinnerOverlay } from './game/WinnerOverlay';
import { Leaderboard } from './game/Leaderboard';
import { FinishZone } from './game/FinishZone';


interface GameBoardProps {
    roomCode: string;
    currentUser: { id: string; name: string };
    gameMode?: '101' | 'standard';
    isSpectator?: boolean;
    initialGameState?: GameState | null;
}


// Removed inline definition of DraggableTile component

export const GameBoard: React.FC<GameBoardProps> = ({
    roomCode,
    currentUser,
    gameMode,
    isSpectator = false,
    initialGameState = null
}) => {
    const is101Mode = gameMode === '101';
    const socket = getSocket();
    const [gameState, setGameState] = useState<GameState | null>(initialGameState);
    const [playersMap, setPlayersMap] = useState<Record<string, { name: string, avatar: string }>>({});
    const [localHand, setLocalHand] = useState<TileData[]>(initialGameState?.players.find(p => p.id === currentUser.id)?.hand || []); // For Drag and Drop
    // RACK LOGIC (30 Slots)
    const [rackSlots, setRackSlots] = useState<(TileData | null)[]>(() => {
        if (initialGameState) {
            const myIdx = initialGameState.players.findIndex(p => p.id === currentUser.id);
            if (myIdx !== -1) {
                const slots = Array(30).fill(null);
                initialGameState.players[myIdx].hand.forEach((t: any, i: number) => { if (i < 30) slots[i] = t; });
                return slots;
            }
        }
        return Array(30).fill(null);
    });
    const [showSideHint, setShowSideHint] = useState(false);
    const [lastTurnState, setLastTurnState] = useState(false);
    const [lastDiscardCount, setLastDiscardCount] = useState<number>(0);
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
    const [arrangeMode, setArrangeMode] = useState<'groups' | 'color' | 'value' | 'potential'>('groups');
    const [roomData, setRoomData] = useState<any>(null);
    const { t } = useLanguage();
    const [isPlayingIntro, setIsPlayingIntro] = useState(!!initialGameState && initialGameState.status === 'PLAYING');
    const [introStep, setIntroStep] = useState<'dealing' | 'revealing' | 'fading' | 'done'>(!!initialGameState && initialGameState.status === 'PLAYING' ? 'dealing' : 'done');
    const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
        useSensor(MouseSensor),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

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

                // Sync disconnected players from room data
                const disconnectedSet = new Set<string>();
                data.players.forEach((p: any) => {
                    if (p.connected === false) disconnectedSet.add(p.id);
                });
                setDisconnectedPlayers(disconnectedSet);
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




    // Track turn change to show hint AND play sound (conditionally)
    useEffect(() => {
        if (gameState) {
            const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);
            const isMyTurn = gameState.players[myIdx]?.isTurn;

            if (isMyTurn && !lastTurnState) {
                // Determine who played before me
                // Turn order 0->1->2->3. Predecessor is (myIdx - 1)
                // If the turn passed from Left Neighbor -> Me, user requested SILENCE.
                // Because they see the tile throw.

                // Note: We don't track 'who played last' explicitly in GameState, 
                // but we can assume normal flow.
                // However, 'your_turn' is generic. 
                // Let's just silence it if the last action was a discard from left? 
                // Or simply: If it's my turn, and I just saw a discard from left...

                // Let's use the 'prevDiscardCounts' logic to set a flag? 
                // Or better: Just don't play 'your_turn' sound if the game flow is normal?
                // Users usually want turn sound if they are alt-tabbed.
                // But the user specifically hates "dın dın" on left throw.
                // So let's skip 'your_turn' sound.

                // soundManager.play('your_turn'); // DISABLED based on user feedback "gelmesin artık"
                setShowSideHint(true);
                const timer = setTimeout(() => setShowSideHint(false), 5000);
                return () => clearTimeout(timer);
            }
            setLastTurnState(isMyTurn);
        }
    }, [gameState, currentUser.id, lastTurnState]);

    // Track discards per player to handle conditional sounds
    const [prevDiscardCounts, setPrevDiscardCounts] = useState<number[]>([]);

    useEffect(() => {
        if (!gameState) return;

        const currentCounts = gameState.players.map(p => p.discards.length);
        const myIdx = gameState.players.findIndex(p => p.id === currentUser.id);

        if (prevDiscardCounts.length === currentCounts.length) {
            currentCounts.forEach((count, idx) => {
                if (count > (prevDiscardCounts[idx] || 0)) {
                    // Safety check
                    if (myIdx === -1) {
                        soundManager.play('discard');
                        return;
                    }

                    // Calculate Left Neighbor Index (Previous Player)
                    // If flow is 0->1->2->3, player (idx-1) throws to idx.
                    // Visually: Bottom(0), Right(1), Top(2), Left(3).
                    // 3 throws to 0. 3 is Left of 0.
                    // Play sound for everyone (including left neighbor now, as requested)
                    // The 'dın dın' (your_turn) sound is silenced elsewhere, so this will just be the 'click/discard' sound.
                    soundManager.play('discard');
                }
            });
        }

        setPrevDiscardCounts(currentCounts);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState?.players, currentUser.id]);


    // Intro Animation Sequence
    useEffect(() => {
        if (introStep === 'dealing') {
            soundManager.play('dealing', 0.02);
            // Move to revealing after some time or wait for socket? 
            // The original logic had a timer. Let's keep it simple.
            // If server emits jokerRevealed, it sets introStep to 'revealing'.
            return;
        } else if (introStep === 'revealing') {
            // Show reveal for 3 seconds with smooth fade-out
            const timer = setTimeout(() => {
                setIntroStep('done');
                setIsPlayingIntro(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [introStep]);

    // Guard against unwanted refresh
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Standard for Chrome
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleLeave = () => {
        if (window.confirm(t("leave_confirm"))) {
            localStorage.removeItem("okey_session_token");
            window.location.href = '/';
        }
    };

    // State for animations

    useEffect(() => {
        const onGameState = (state: GameState) => {
            setGameState(state);
            const myIdx = state.players.findIndex(p => p.id === currentUser.id);
            if (myIdx !== -1) {
                setLocalHand(state.players[myIdx].hand);
            }
        };

        const onGameStarted = (state?: GameState) => {
            if (state) setGameState(state);
            setIsPlayingIntro(true);
            setIntroStep('dealing');
        };

        const onPlayerLeft = (playerId: string) => {
            setDisconnectedPlayers(prev => {
                const newSet = new Set(prev);
                newSet.add(playerId);
                return newSet;
            });

            // Show notification - using a ref or just accepting slight closure staleness
            // Since playersMap is updated via updateRoom, we can use a functional update or just check current state
            setPlayersMap(currentMap => {
                const info = currentMap[playerId];
                if (info) {
                    setShowSideHint(true);
                    setDisconnectMsg(`${info.name} oyundan ayrıldı!`);
                    setTimeout(() => setDisconnectMsg(null), 3000);
                }
                return currentMap;
            });
        };

        const onError = (msg: string) => {
            console.error("Game Error:", msg);

            // Suppress trivial errors from double-clicks or known states
            const suppressedErrors = [
                "Did you already draw?",
                "Already drew",
                "Not your turn",
                "You must draw before discarding" // happens if drag too fast
            ];

            if (suppressedErrors.some(e => msg.includes(e))) {
                // Do not play sound, do not show toast
                return;
            }

            soundManager.play('error');
            setDisconnectMsg(msg);
            setTimeout(() => setDisconnectMsg(null), 4000);
        };

        const onJokerRevealed = (data: { indicator: any, okeyTile: any }) => {
            console.log('[jokerRevealed] Received Joker reveal:', data);
            soundManager.play('joker_reveal', 0.5);
            setIntroStep('revealing');
        };

        socket.on('gameState', onGameState);
        socket.on('gameStarted', onGameStarted);
        socket.on('playerLeft', onPlayerLeft);
        socket.on('error', onError);
        socket.on('jokerRevealed', onJokerRevealed);

        socket.emit('getGameState');
        socket.emit('checkRoom', roomCode);

        return () => {
            socket.off('gameState', onGameState);
            socket.off('gameStarted', onGameStarted);
            socket.off('playerLeft', onPlayerLeft);
            socket.off('jokerRevealed', onJokerRevealed);
            socket.off('error', onError);
        };
    }, [socket, currentUser.id, roomCode]); // Removed playersMap from dependencies

    const handleDragStart = () => {
        soundManager.play('grab');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        // Play drop sound for any drag end
        soundManager.play('drop');

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

    /* EXTRACTED COMPONENTS USED IN MAIN JSX */
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

        // Robust check to prevent double-draw / double-click
        if (!gameState || !player || pIdx === undefined) return;

        // Check if already 15 tiles (already drawn)
        if (player.hand.length >= 15) return;

        // Check if turn
        if (!player.isTurn) return;

        // Check visual animations
        if (drawStatus.isPending) return;

        setDrawStatus({ isPending: true, source: 'left', animatingTile: null, stage: 'flying' }); // animatingTile set below

        const leftPlayerIndex = (pIdx - 1 + gameState.players.length) % gameState.players.length;
        if (gameState.players[leftPlayerIndex].discards.length === 0) return;

        const tileToTake = gameState.players[leftPlayerIndex].discards.slice(-1)[0];

        // Update local state immediately for animation
        setDrawStatus(prev => ({ ...prev, animatingTile: tileToTake }));
        socket.emit("gameAction", { type: "DRAW_LEFT" });
    };

    const handleFinishGame = (tileId: number) => {
        const pIdx = gameState?.players.findIndex(p => p.id === currentUser.id);
        if (pIdx === undefined || pIdx === -1 || !gameState) return;

        const handLength = gameState.players[pIdx].hand.length;

        // Client-side validation: Must have 15 tiles to finish
        if (handLength !== 15) {
            soundManager.play('error');
            // Show a non-blocking toast/notification instead of throwing error
            setDisconnectMsg("Bitirmek için elinizde 15 taş olmalı (Bitiş taşı dahil)!");
            setTimeout(() => setDisconnectMsg(null), 4000);
            return;
        }

        socket.emit('gameAction', { type: 'FINISH_GAME', payload: { tileId } });
    };

    const handleRestartVote = () => {
        socket.emit('restartVote');
    };

    const handleAutoArrange = () => {
        if (isArranging || !gameState) return;
        soundManager.play('click');
        setIsArranging(true);

        const allTiles = rackSlots.filter((t): t is TileData => t !== null);
        if (allTiles.length === 0) {
            setIsArranging(false);
            return;
        }

        // Cycle to next mode
        const modes: ('groups' | 'color' | 'value' | 'potential')[] = ['groups', 'color', 'value', 'potential'];
        const currentIndex = modes.indexOf(arrangeMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setArrangeMode(nextMode);

        // Separate tiles for utilities
        const okeyTiles = allTiles.filter(t => t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value);
        const fakeJokers = allTiles.filter(t => t.color === 'fake');
        const normalTiles = allTiles.filter(t => {
            const isOkey = t.color === gameState.okeyTile.color && t.value === gameState.okeyTile.value;
            return !isOkey && t.color !== 'fake';
        });

        let newSlots: (TileData | null)[] = [];

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

        // Pad to 30 slots
        const paddedSlots = [...newSlots];
        while (paddedSlots.length < 30) paddedSlots.push(null);
        if (paddedSlots.length > 30) paddedSlots.length = 30;

        setRackSlots(paddedSlots);
        setTimeout(() => setIsArranging(false), 500);
    };
    const getColorName = (color: string) => {
        const colorMap: Record<string, { tr: string, en: string }> = {
            'red': { tr: 'Kırmızı', en: 'Red' },
            'blue': { tr: 'Mavi', en: 'Blue' },
            'black': { tr: 'Siyah', en: 'Black' },
            'yellow': { tr: 'Sarı', en: 'Yellow' },
            'fake': { tr: 'Sahte Okey', en: 'Fake Joker' }
        };
        const langCode = t('lang_code') === 'tr' ? 'tr' : 'en';
        return colorMap[color]?.[langCode] || color;
    };

    if (!gameState) return <div className="h-screen bg-[#1e3a29] flex items-center justify-center text-white">{t("connecting")}</div>;

    // --- RENDER INTRO COMPONENT ---
    const IntroOverlay = () => {
        if (!isPlayingIntro || introStep === 'done') return null;

        return (
            <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: introStep === 'revealing' ? [1, 1, 0] : 1 }}
                transition={{
                    duration: introStep === 'revealing' ? 3 : 1,
                    times: introStep === 'revealing' ? [0, 0.8, 1] : undefined,
                    ease: "easeInOut"
                }}
                className={`fixed inset-0 z-[100] flex items-center justify-center ${is101Mode ? 'bg-[#2a0808]' : 'bg-[#0f0c29]'} overflow-hidden`}
            >
                {/* Immersive Background */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 animate-pulse"></div>
                <div className={`absolute inset-0 ${is101Mode ? 'bg-gradient-to-br from-red-900/40 via-transparent to-rose-900/40' : 'bg-gradient-to-br from-purple-900/40 via-transparent to-blue-900/40'}`}></div>

                {/* Central Focus */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">

                    {/* 1. DEALING ANIMATION (PREMIUM & PHYSICAL) */}
                    {introStep === 'dealing' && (
                        <div className="flex flex-col items-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-16 text-center"
                            >
                                <h2 className={`text-6xl md:text-8xl font-black text-transparent bg-clip-text ${is101Mode ? 'bg-gradient-to-b from-red-200 to-red-600' : 'bg-gradient-to-b from-yellow-200 to-yellow-600'} tracking-tighter italic drop-shadow-2xl`}>
                                    OYUN BAŞLIYOR
                                </h2>
                                <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mt-4"></div>
                            </motion.div>

                            <div className="relative w-80 h-80 flex items-center justify-center">
                                {/* Deck */}
                                <motion.div
                                    className="relative z-20 w-32 h-44 bg-[#3e2723] rounded-2xl shadow-2xl border-2 border-white/10 flex items-center justify-center"
                                >
                                    <div className="text-5xl opacity-40">🎴</div>
                                </motion.div>

                                {/* Flying Tile Stacks */}
                                {[0, 1, 2, 3].map((playerIdx) => (
                                    [0, 1, 2].map((stackIdx) => (
                                        <motion.div
                                            key={`${playerIdx}-${stackIdx}`}
                                            initial={{ x: 0, y: 0, scale: 0.5, opacity: 0, rotate: 0 }}
                                            animate={{
                                                x: playerIdx === 0 ? 0 : playerIdx === 1 ? 500 : playerIdx === 2 ? 0 : -500,
                                                y: playerIdx === 0 ? 500 : playerIdx === 1 ? 0 : playerIdx === 2 ? -500 : 0,
                                                scale: 1,
                                                opacity: [0, 1, 0],
                                                rotate: playerIdx * 90 + (stackIdx * 10)
                                            }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "circOut",
                                                delay: playerIdx * 0.2 + stackIdx * 0.1
                                            }}
                                            className="absolute z-10"
                                        >
                                            <div className="w-14 h-20 bg-[#fdfcdc] rounded-lg shadow-xl border border-gray-400"></div>
                                        </motion.div>
                                    ))
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. JOKER REVEAL ANIMATION (STAYED PREMIUM) */}
                    {introStep === 'revealing' && (
                        <div className="relative flex flex-col items-center">
                            {/* Shockwave */}
                            <motion.div
                                initial={{ scale: 0, opacity: 1 }}
                                animate={{ scale: 6, opacity: 0 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className={`absolute w-64 h-64 rounded-full border-[10px] ${is101Mode ? 'border-red-500' : 'border-yellow-400'} z-0`}
                            />

                            <motion.div
                                initial={{ scale: 0.2, rotateY: -180, opacity: 0 }}
                                animate={{ scale: 1.2, rotateY: 0, opacity: 1 }}
                                transition={{ duration: 0.8, ease: "backOut" }}
                                className="relative z-10 w-64 h-80 perspective-1000"
                            >
                                <div className={`w-full h-full relative preserve-3d rounded-[2.5rem] overflow-hidden ${is101Mode ? 'bg-red-950 border-4 border-red-600 shadow-[0_0_150px_rgba(220,38,38,0.7)]' : 'bg-amber-950 border-4 border-yellow-500 shadow-[0_0_150px_rgba(234,179,8,0.7)]'}`}>
                                    <div className="absolute inset-0 flex items-center justify-center scale-[3]">
                                        <Tile {...gameState.indicator} size="lg" />
                                    </div>
                                    <motion.div
                                        animate={{ x: ['-200%', '200%'] }}
                                        transition={{ duration: 1.5, repeat: 0, ease: "linear", delay: 0.5 }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-20"
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="text-center mt-16 z-20"
                            >
                                <h3 className={`text-2xl ${is101Mode ? 'text-red-400' : 'text-yellow-400'} font-black uppercase tracking-[1em] mb-4 opacity-70`}>GÖSTERGE</h3>
                                <h2 className="text-8xl font-black text-white drop-shadow-[0_10px_40px_rgba(0,0,0,1)] tracking-tighter">
                                    <span className={`${is101Mode ? 'text-red-200' : 'text-yellow-200'}`}>{getColorName(gameState.indicator.color).toUpperCase()}</span> {gameState.indicator.value}
                                </h2>

                                <motion.div
                                    initial={{ scaleX: 0, opacity: 0 }}
                                    animate={{ scaleX: 1, opacity: 1 }}
                                    transition={{ delay: 1.2, duration: 0.8 }}
                                    className="mt-20 h-1 w-[30rem] bg-gradient-to-r from-transparent via-white/40 to-transparent relative mx-auto"
                                >
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: -50 }}
                                        transition={{ delay: 1.5 }}
                                        className="absolute left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl px-12 py-4 rounded-3xl border border-white/20 shadow-2xl"
                                    >
                                        <span className={`text-4xl font-black italic tracking-[0.3em] ${is101Mode ? 'text-red-200' : 'text-yellow-200'} animate-pulse`}>
                                            MAÇ BAŞLIYOR
                                        </span>
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        </div>
                    )}
                </div>

                <style jsx>{`
                    .preserve-3d { transform-style: preserve-3d; }
                    .backface-hidden { backface-visibility: hidden; }
                    @keyframes animate-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </motion.div>
        );
    };

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

            {/* Particle Atmosphere */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{
                            x: Math.random() * 100 + "%",
                            y: Math.random() * 100 + "%",
                            opacity: 0,
                            scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{
                            y: ["-10%", "110%"],
                            opacity: [0, 0.2, 0],
                            rotate: 360
                        }}
                        transition={{
                            duration: Math.random() * 10 + 10,
                            repeat: Infinity,
                            ease: "linear",
                            delay: Math.random() * 10
                        }}
                        className={`absolute w-1 h-1 rounded-full ${is101Mode ? 'bg-red-200' : 'bg-white'}`}
                    />
                ))}
            </div>

            {/* Intro Overlay moved outside blurred container */}
            {(isPlayingIntro && introStep !== 'done') && <IntroOverlay />}

            <motion.div
                animate={{
                    scale: isPlayingIntro ? 1.05 : 1,
                    filter: isPlayingIntro ? 'blur(2px) brightness(0.8)' : 'blur(0px) brightness(1)'
                }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="w-full h-full relative"
            >

                <AnimatePresence>
                </AnimatePresence>

                <DrawAnimationOverlay />
                <DiscardAnimationOverlay />
                {gameState.status === 'FINISHED' && (
                    <WinnerOverlay
                        gameState={gameState}
                        currentUser={currentUser}
                        roomData={roomData}
                        onRestartVote={handleRestartVote}
                        onLeave={handleLeave}
                    />
                )}
                <Leaderboard
                    isOpen={isLeaderboardOpen}
                    onClose={() => setIsLeaderboardOpen(false)}
                    players={roomData?.players || []}
                    winScores={roomData?.winScores || {}}
                />
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
                    {!isSpectator ? (
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
                                    <FinishZone isMyTurn={isMyTurn} gameMode={gameMode} />

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
                    ) : (
                        <div className="relative bg-[#1a1a2e]/60 w-full max-w-[950px] h-[160px] rounded-t-3xl border-t-2 border-x-2 border-blue-500/30 flex flex-col items-center justify-center backdrop-blur-xl shadow-[0_-20px_50px_rgba(59,130,246,0.2)] animate-pulse">
                            <div className="text-4xl mb-2">👁️</div>
                            <div className="text-blue-400 font-black text-2xl tracking-widest uppercase">{t("spectating") || "İZLİYORSUNUZ"}</div>
                            <div className="text-blue-400/40 text-[10px] font-bold mt-1">Sadece izleme modu • Müdahele edilemez</div>
                        </div>
                    )}
                </div>
            </motion.div>
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
