"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/utils/socket";
import { GameBoard } from "@/components/GameBoard";
import { useLanguage } from "@/contexts/LanguageContext";
import { soundManager } from "@/utils/soundManager";
import { motion, AnimatePresence } from "framer-motion";

import { RoomData, GameState, TileData, RoomSettings } from "@/components/game/types";

export default function RoomPage() {
    const { code } = useParams();
    const socket = getSocket();
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const { t } = useLanguage();

    const [isStarting, setIsStarting] = useState(false);
    const [initialGameState, setInitialGameState] = useState<GameState | null>(null);
    const [isFreshStart, setIsFreshStart] = useState(false); // Track if this is a fresh start for animations
    const [emotes, setEmotes] = useState<{ id: number, playerId: string, emote: string, text?: string }[]>([]);

    useEffect(() => {
        const check = () => {
            if (code && !roomData && socket.connected) {
                console.log("Checking room:", code);
                socket.emit("checkRoom", code);
            }
        };

        if (socket.connected) {
            check();
        } else {
            console.log("Socket not connected, waiting...");
            socket.on("connect", check);
        }

        // Interval fallback for stubborn connections
        const interval = setInterval(() => {
            if (code && !roomData && socket.connected) {
                socket.emit("checkRoom", code);
            }
        }, 2000);

        return () => {
            socket.off("connect", check);
            clearInterval(interval);
        };
    }, [code, socket, roomData]);

    const [isSpectator, setIsSpectator] = useState(false);

    useEffect(() => {
        socket.on("isSpectator", (val: boolean) => setIsSpectator(val));

        socket.on("updateRoom", (data: RoomData) => {
            setRoomData(data);
        });

        socket.on("gameStarted", (gameState: GameState) => {
            console.log("Game started:", gameState);
            setInitialGameState(gameState);
            setRoomData(prev => prev ? { ...prev, gameStarted: true } : null);
            setIsStarting(false);
            setIsFreshStart(true); // Enable intro animations
        });

        socket.on("kicked", (msg: string) => {
            alert(msg);
            localStorage.removeItem("okey_session_token");
            router.push('/');
        });

        socket.on("banned", (msg: string) => {
            alert(msg);
            localStorage.removeItem("okey_session_token");
            router.push('/');
        });

        socket.on("autoTriggerStart", () => {
            console.log("Auto-triggering start...");
            socket.emit("startGame");
        });

        socket.on("error", (msg: string) => {
            console.error("Room Error:", msg);

            const gameplayErrors = [
                "You must draw before discarding",
                "Not your turn",
                "Did you already draw?",
                "Must draw before discard",
                "Tile not in hand",
                "Missing tileId",
                "Hand is not a winning hand!",
                "Select a tile to finish with",
                "Already drew"
            ];

            if (gameplayErrors.some(e => msg.includes(e))) {
                alert("⚠️ " + msg);
            } else {
                setError(msg);
            }
        });

        socket.on("emoteReceived", (data: { playerId: string, emote: string, text?: string }) => {
            const player = roomData?.players.find(p => p.id === data.playerId);
            if (player) {
                // Show floating emote
                console.log(`Emote from ${player.name}: ${data.emote}`);
                soundManager.play('click');
            }
            setEmotes(prev => [...prev, { id: Math.random(), playerId: data.playerId, emote: data.emote, text: data.text }]);
            setTimeout(() => {
                setEmotes(prev => prev.slice(1));
            }, 3000);
        });

        return () => {
            socket.off("updateRoom");
            socket.off("gameStarted");
            socket.off("roomCountdown");
            socket.off("kicked");
            socket.off("banned");
            socket.off("autoTriggerStart");
            socket.off("emoteReceived");
        };
    }, [socket, router]);

    const handleCopy = () => {
        // Copy full URL
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStartGame = () => {
        if (isStarting) return;
        setIsStarting(true);
        socket.emit("startGame");
    };

    const handleAddBot = () => {
        soundManager.play('click');
        socket.emit("addBot");
    };

    const handleLeave = () => {
        if (confirm(t("leave_confirm"))) {
            localStorage.removeItem("okey_session_token");
            socket.disconnect();
            socket.connect();
            router.push('/');
        }
    };

    const handleKick = (playerId: string) => {
        if (confirm(t("kick_confirm") || "Are you sure you want to kick this player?")) {
            socket.emit("kickPlayer", playerId);
        }
    };

    const handleToggleReady = () => {
        soundManager.play('click');
        socket.emit("toggleReady");
    };

    const handleUpdateSettings = (settings: Partial<RoomSettings>) => {
        socket.emit("updateSettings", settings);
    };

    const handleSendEmote = (emoteKey: string, emoji: string) => {
        soundManager.play('click');
        const text = t(emoteKey);
        // We emit both emoji and text or just key? 
        // Let's emit compiled text to be safe, or key if we want receiver to translate.
        // User said: "emojilere yazılar da ekle".
        // Let's send the text as well so everyone sees it (maybe receiver translates if we send key, but keeping it simple).
        // Sending key allows full localization on receiver side!
        // But current socket event might just be string?
        // Let's change payload to object or just send text string if schema allows?
        // Schema checks? It receives 'emote' string.
        // I will hack it: send JSON string or just text? 
        // Or better: Send emoji + " " + text?
        // Or update server logic?
        // Wait, I can only update server room manager to pass through whatever payload? 
        // RoomManager.ts: socket.on('sendEmote', (emote: string) => ... emit('emoteReceived', { emote: emote })
        // It passes string. So I can pass a JSON string or just the emoji.
        // But better is to just update client to show text based on emoji map LOCALLY if I send valid key/emoji?
        // Wait, different languages...
        // If I send "Yanıyorsun!", an English user sees Turkish.
        // Best approach: Send the KEY (e.g. "emote_fire") or identifiers.
        // Client `emote` state needs to support text lookup.
        // Let's send the EMOJI char itself, and map it back to text on receiver? 
        // Mapping: "🔥" -> "emote_fire".

        socket.emit("sendEmote", emoji);
    };


    // Memoize currentUser to prevent infinite loop in GameBoard
    const currentUser = useMemo(() => ({
        id: socket.id as string,
        name: roomData?.players.find(p => p.id === socket.id)?.name || ""
    }), [socket.id, roomData?.players]);

    // Redirect if connected but not in player list (Ghost/Direct Link user)
    useEffect(() => {
        if (roomData && socket.id) {
            const isMember = roomData.players.some(p => p.id === socket.id);
            if (!isMember) {
                // Redirect to home to join
                router.push(`/?join=${code}`);
            }
        }
    }, [roomData, socket.id, code, router]);

    if (error) {
        return (
            <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center text-white font-sans">
                <div className="text-center bg-white/10 p-8 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl">
                    <div className="text-6xl mb-4">😕</div>
                    <h1 className="text-2xl font-bold mb-6">{error}</h1>
                    <button onClick={() => router.push('/')} className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold border border-white/10 hover:scale-105">
                        {t("return_home")}
                    </button>
                </div>
            </div>
        );
    }

    const is101Mode = roomData?.gameMode === '101';

    if (!roomData) return <div className={`h-screen ${is101Mode ? 'bg-[#2a0808]' : 'bg-[#0f0c29]'} text-white flex flex-col gap-4 items-center justify-center font-bold text-2xl`}>
        <div className={`w-16 h-16 border-4 ${is101Mode ? 'border-t-red-500 border-b-red-500' : 'border-t-yellow-400 border-b-yellow-400'} border-r-transparent border-l-transparent rounded-full animate-spin`}></div>
        <div className="animate-pulse tracking-widest">{t("connecting")}</div>
    </div>;



    if (roomData.gameStarted) {
        return (
            <GameBoard
                roomCode={code as string}
                currentUser={currentUser}
                gameMode={roomData.gameMode}
                isSpectator={isSpectator}
                initialGameState={initialGameState}
                isFreshStart={isFreshStart}
            />
        );
    }

    const isHost = roomData.players.length > 0 && roomData.players[0].id === socket.id;

    // Waiting Room UI (Premium Glassmorphism)
    return (
        <div className={`min-h-screen ${is101Mode ? 'bg-[#2a0808]' : 'bg-[#0f0c29]'} flex flex-col items-center justify-center relative overflow-hidden font-sans p-4`}>
            {/* Background Atmosphere */}
            <div className={`absolute inset-0 ${is101Mode ? 'bg-gradient-to-br from-red-900/40 via-[#2a0808] to-rose-900/40' : 'bg-gradient-to-br from-purple-900/40 via-[#0f0c29] to-blue-900/40'} pointer-events-none`}></div>

            {isSpectator && (
                <div className="absolute top-4 z-50 bg-blue-500/80 backdrop-blur-md px-6 py-2 rounded-full border border-blue-400/50 text-white font-bold animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                    👁️ {t("spectator_mode") || "İzleyici Modu: Oda Dolu"}
                </div>
            )}
            <div className={`absolute top-0 right-0 w-[500px] h-[500px] ${is101Mode ? 'bg-red-600/20' : 'bg-purple-600/20'} rounded-full blur-[100px] pointer-events-none animate-pulse`}></div>
            <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] ${is101Mode ? 'bg-rose-600/20' : 'bg-blue-600/20'} rounded-full blur-[100px] pointer-events-none animate-pulse`} style={{ animationDelay: "1s" }}></div>

            {/* Quick Emotes Panel */}
            <div className="absolute bottom-6 left-6 z-50 flex gap-2 flex-wrap max-w-[50vw]">
                {[
                    { key: "emote_fire", icon: "🔥" },
                    { key: "emote_cool", icon: "😎" },
                    { key: "emote_think", icon: "🤔" },
                    { key: "emote_wave", icon: "👋" },
                    { key: "emote_dice", icon: "🎲" },
                    { key: "emote_laugh", icon: "😂" },
                    { key: "emote_luck", icon: "🍀" }, // Added luck
                    { key: "emote_sad", icon: "😢" },   // Added sad
                    { key: "emote_clap", icon: "👏" }   // Added clap
                ].map((item) => (
                    <button
                        key={item.key}
                        onClick={() => handleSendEmote(item.key, item.icon)}
                        className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:scale-125 transition-transform flex items-center justify-center text-2xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 relative group/tooltip"
                    >
                        {item.icon}
                        {/* Tooltip for text preview */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                            {t(item.key)}
                        </div>
                    </button>
                ))}
            </div>

            <div className="relative w-full max-w-4xl grid grid-cols-1 md:grid-cols-[350px_1fr] gap-8">

                {/* LEFT COL: INFO CARD */}
                <div className="flex flex-col gap-6">
                    {/* 101 Mode Label */}
                    {is101Mode && (
                        <div className="bg-red-600/20 backdrop-blur-xl rounded-3xl p-6 border border-red-500/30 shadow-2xl flex flex-col items-center justify-center animate-pulse">
                            <div className="text-4xl font-black text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">101</div>
                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mt-1">Okey 101 Modu</div>
                        </div>
                    )}

                    {/* Room Code Card */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-2xl group-hover:bg-yellow-500/30 transition-all"></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/50 mb-4">{t("room_code")}</div>
                            <div
                                onClick={handleCopy}
                                className="text-6xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-6 cursor-pointer hover:scale-110 transition-transform active:scale-95 drop-shadow-lg"
                                title={t("click_copy")}
                            >
                                {code}
                            </div>
                            <button
                                onClick={() => { soundManager.play('click'); handleCopy(); }}
                                className={`
                                    flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300
                                    ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}
                                `}
                            >
                                {copied ? <span className="flex items-center gap-2">✅ {t("copied")}</span> : <span className="flex items-center gap-2">📋 {t("copy")}</span>}
                            </button>
                        </div>
                    </div>

                    {/* Exit Button */}
                    <button
                        onClick={() => { soundManager.play('click'); handleLeave(); }}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50 p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group mb-2"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">⬅</span> {t("exit")}
                    </button>

                    {/* Host Settings Panel */}
                    {isHost && roomData.settings && (
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-2xl space-y-4">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 border-b border-white/5 pb-3 mb-2 flex items-center gap-2">
                                ⚙️ {t("settings")}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-white/60 mb-2">
                                        <span>{t("turn_time")}</span>
                                        <span className="text-yellow-400">{roomData.settings.turnTime} {t("seconds")}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[15, 30, 60].map(time => (
                                            <button
                                                key={time}
                                                onClick={() => handleUpdateSettings({ turnTime: time })}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${roomData.settings?.turnTime === time ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                                            >
                                                {time}s
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold text-white/60 mb-2">
                                        <span>{t("target_score")}</span>
                                        <span className="text-yellow-400">{roomData.settings.targetScore}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[10, 20, 50].filter(() => false).concat([3, 5, 10]).map(score => ( // Updated to 3, 5, 10
                                            <button
                                                key={score}
                                                onClick={() => handleUpdateSettings({ targetScore: score })}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${roomData.settings?.targetScore === score ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                                            >
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


                {/* RIGHT COL: PLAYERS & ACTION */}
                <div className="flex flex-col gap-6">


                    {/* Player Grid */}
                    <div className="bg-black/20 backdrop-blur-md rounded-[2rem] p-6 border border-white/5 min-h-[400px] flex flex-col">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                👥 {t("players")} <span className="bg-white/10 px-2 py-0.5 rounded text-sm text-white/60">{roomData.players.length}/4</span>
                            </h2>
                            {roomData.players.length < 4 && (
                                <div className="text-xs text-yellow-400/80 font-medium animate-pulse">
                                    {t("waiting_players")}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 flex-1 content-start">
                            {roomData.players.map((player, index) => (
                                <div key={player.id} className="group relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className={`
                                        relative bg-[#1e293b]/60 backdrop-blur border p-4 rounded-2xl flex items-center gap-5 transition-all duration-300
                                        ${player.id === socket.id ? 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 hover:border-white/20'}
                                    `}>
                                        {/* Avatar */}
                                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-5xl bg-gradient-to-b from-white/10 to-white/5 shadow-inner border border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform">
                                            {player.avatar || "👤"}
                                            {/* Turn/Status Dot (Optional) */}
                                            {index === 0 && <div className="absolute top-0 right-0 bg-yellow-400 w-4 h-4 rounded-full border-2 border-[#1e293b] shadow-sm" title={t("host")}></div>}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white text-lg tracking-wide truncate">{player.name}</span>
                                                {player.id === socket.id && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{t("you")}</span>}
                                                {index === 0 && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">HOST</span>}
                                            </div>
                                            {/* Emote Bubble */}
                                            <AnimatePresence>
                                                {emotes.find(e => e.playerId === player.id) && (
                                                    <motion.div
                                                        key={emotes.find(e => e.playerId === player.id)?.id}
                                                        initial={{ scale: 0, y: 0, opacity: 0 }}
                                                        animate={{ scale: 1.1, y: -50, opacity: 1 }}
                                                        exit={{ scale: 0.5, y: -70, opacity: 0 }}
                                                        className="absolute -top-2 -right-10 bg-white text-black px-4 py-2 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.3)] z-50 border-2 border-yellow-400 min-w-[80px]"
                                                    >
                                                        <span className="text-2xl">{emotes.find(e => e.playerId === player.id)?.emote}</span>
                                                        <span className="text-xs font-bold whitespace-nowrap">
                                                            {/* Reverse lookup text from icon - quick hack since we send icon */}
                                                            {(() => {
                                                                const icon = emotes.find(e => e.playerId === player.id)?.emote;
                                                                const map: Record<string, string> = {
                                                                    "🔥": "emote_fire", "😎": "emote_cool", "🤔": "emote_think",
                                                                    "👋": "emote_wave", "🎲": "emote_dice", "😂": "emote_laugh",
                                                                    "🍀": "emote_luck", "😢": "emote_sad", "👏": "emote_clap"
                                                                };
                                                                return t(map[icon as string] || "");
                                                            })()}
                                                        </span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            {/* Ready Status */}
                                            <div className={`flex items-center gap-1.5 mt-1`}>
                                                <div className={`w-2 h-2 rounded-full ${player.isReady ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-gray-600'}`}></div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${player.isReady ? 'text-green-400' : 'text-gray-500'}`}>
                                                    {player.isReady ? t("ready") : t("waiting_players")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Host Controls */}
                                        {isHost && player.id !== socket.id && (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { soundManager.play('click'); handleKick(player.id); }}
                                                    className="bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white p-2 rounded-lg transition-colors border border-red-500/30"
                                                    title={t("kick")}
                                                >
                                                    👢
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Empty Slots */}
                            {Array.from({ length: Math.max(0, 4 - roomData.players.length) }).map((_, i) => (
                                <div key={`empty-${i}`} className={`border-2 border-dashed border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all ${i === 0 && isHost ? 'hover:border-yellow-500/30 hover:bg-white/5 cursor-pointer group/bot' : 'opacity-50 select-none'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${i === 0 && isHost ? 'bg-white/10' : 'bg-white/5 animate-pulse'}`}>
                                            {i === 0 && isHost ? "🤖" : ""}
                                        </div>
                                        <div className={`h-4 ${i === 0 && isHost ? 'w-auto text-white/40 font-bold' : 'w-32 bg-white/5 rounded animate-pulse'}`}>
                                            {i === 0 && isHost ? "Bot Ekle" : ""}
                                        </div>
                                    </div>
                                    {i === 0 && isHost && (
                                        <button
                                            onClick={handleAddBot}
                                            className="bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 px-4 py-2 rounded-xl text-sm font-bold border border-yellow-500/30 transition-all opacity-0 group-hover/bot:opacity-100"
                                        >
                                            + EKLE
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Start Action */}
                    <div className="mt-auto flex gap-4">
                        {!isHost && (
                            <button
                                onClick={handleToggleReady}
                                className={`flex-1 py-5 rounded-[1.5rem] font-black text-xl transition-all border-b-8 shadow-xl active:border-b-0 active:translate-y-2 ${roomData.players.find(p => p.id === socket.id)?.isReady ? 'bg-green-500 text-white border-green-700' : 'bg-gray-700 text-gray-400 border-gray-900'}`}
                            >
                                {roomData.players.find(p => p.id === socket.id)?.isReady ? t("ready") : t("unready")}
                            </button>
                        )}

                        {isHost ? (
                            <div className="flex-1 flex flex-col gap-2">
                                {!roomData.players.every(p => p.isReady || p.id === socket.id || p.isBot) && (
                                    <div className="text-center text-xs font-bold text-yellow-400 animate-pulse bg-yellow-400/10 py-2 rounded-xl border border-yellow-400/20">
                                        ⚠️ {t("everyone_ready_warning")}
                                    </div>
                                )}
                                <button
                                    onClick={() => { soundManager.play('click'); handleStartGame(); }}
                                    disabled={roomData.players.length !== 2 && roomData.players.length !== 4 || isStarting}
                                    className={`
                                        w-full relative py-5 rounded-[1.5rem] font-black text-2xl text-white shadow-xl overflow-hidden transition-all duration-300
                                        ${(roomData.players.length !== 2 && roomData.players.length !== 4) || isStarting ? 'bg-gray-600 cursor-not-allowed scale-95 opacity-80 grayscale' : 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:shadow-[0_0_40px_rgba(34,197,94,0.4)] hover:scale-[1.02] active:scale-95'}
                                    `}
                                >
                                    <span className={`relative z-10 flex items-center justify-center gap-3 ${isStarting ? 'animate-pulse' : ''}`}>
                                        {isStarting ? t("starting") : t("start_match")}
                                        {!isStarting && <span className="text-3xl">🚀</span>}
                                    </span>
                                    {/* Shine Effect */}
                                    {!isStarting && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>}
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 bg-white/5 backdrop-blur border border-white/10 py-5 rounded-[1.5rem] text-center text-white/50 font-bold text-lg animate-pulse flex flex-col gap-1 justify-center">
                                <span>{t("waiting_host")}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
