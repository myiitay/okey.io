"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/utils/socket";
import { GameBoard } from "@/components/GameBoard";
import { useLanguage } from "@/contexts/LanguageContext";

interface Player {
    id: string;
    name: string;
    avatar: string;
    readyToRestart?: boolean;
}

interface RoomData {
    id: string;
    players: Player[];
    winScores: Record<string, number>;
    restartCount: number;
    gameStarted: boolean;
}

export default function RoomPage() {
    const { code } = useParams();
    const socket = getSocket();
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const { t } = useLanguage();

    const [countdown, setCountdown] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        if (code && !roomData) {
            socket.emit("checkRoom", code);
        }
    }, [code, socket, roomData]);

    useEffect(() => {
        socket.on("updateRoom", (data: RoomData) => {
            setRoomData(data);
        });

        socket.on("roomCountdown", (count: number) => {
            setCountdown(count);
            setIsStarting(true);
            const interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(interval);
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        socket.on("gameStarted", (gameState: any) => {
            setRoomData(prev => prev ? { ...prev, gameStarted: true } : null);
            setCountdown(null);
            setIsStarting(false);
        });

        socket.on("kicked", (msg: string) => {
            alert(msg);
            router.push('/');
        });

        socket.on("banned", (msg: string) => {
            alert(msg);
            router.push('/');
        });

        socket.on("autoTriggerStart", () => {
            console.log("Auto-triggering start...");
            socket.emit("startGame");
        });

        return () => {
            socket.off("updateRoom");
            socket.off("gameStarted");
            socket.off("roomCountdown");
            socket.off("kicked");
            socket.off("banned");
            socket.off("autoTriggerStart");
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

    const handleLeave = () => {
        if (confirm(t("leave_confirm"))) {
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

    const handleBan = (playerId: string) => {
        if (confirm(t("ban_confirm") || "Are you sure you want to BAN this player permanently from this room?")) {
            socket.emit("banPlayer", playerId);
        }
    };

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

    if (!roomData) return <div className="h-screen bg-[#0f0c29] text-white flex flex-col gap-4 items-center justify-center font-bold text-2xl">
        <div className="w-16 h-16 border-4 border-t-yellow-400 border-r-transparent border-b-yellow-400 border-l-transparent rounded-full animate-spin"></div>
        <div className="animate-pulse tracking-widest">{t("connecting")}</div>
    </div>;

    if (roomData.gameStarted) {
        return <GameBoard roomCode={code as string} currentUser={{ id: socket.id as string, name: "" }} />;
    }

    // --- COUNTDOWN OVERLAY ---
    if (countdown !== null) {
        return (
            <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center relative overflow-hidden font-sans z-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                <div className="text-[15rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 animate-[ping_1s_ease-in-out_infinite] drop-shadow-[0_0_50px_rgba(250,204,21,0.5)]">
                    {countdown}
                </div>
            </div>
        );
    }

    const isHost = roomData.players.length > 0 && roomData.players[0].id === socket.id;

    // Waiting Room UI (Premium Glassmorphism)
    return (
        <div className="min-h-screen bg-[#0f0c29] flex flex-col items-center justify-center relative overflow-hidden font-sans p-4">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-[#0f0c29] to-blue-900/40 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: "1s" }}></div>

            <div className="relative w-full max-w-4xl grid grid-cols-1 md:grid-cols-[350px_1fr] gap-8">

                {/* LEFT COL: INFO CARD */}
                <div className="flex flex-col gap-6">
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
                                onClick={handleCopy}
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
                        onClick={handleLeave}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50 p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">⬅</span> {t("exit")}
                    </button>
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
                                        </div>

                                        {/* Host Controls */}
                                        {isHost && player.id !== socket.id && (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleKick(player.id)}
                                                    className="bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white p-2 rounded-lg transition-colors border border-red-500/30"
                                                    title={t("kick")}
                                                >
                                                    👢
                                                </button>
                                                <button
                                                    onClick={() => handleBan(player.id)}
                                                    className="bg-red-900/40 hover:bg-red-900/90 text-red-400 hover:text-white p-2 rounded-lg transition-colors border border-red-900/30 font-bold"
                                                    title={t("ban")}
                                                >
                                                    🚫
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Empty Slots */}
                            {Array.from({ length: Math.max(0, 4 - roomData.players.length) }).map((_, i) => (
                                <div key={`empty-${i}`} className="border-2 border-dashed border-white/5 rounded-2xl p-4 flex items-center gap-4 opacity-50 select-none">
                                    <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse"></div>
                                    <div className="h-4 w-32 bg-white/5 rounded animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Start Action */}
                    <div className="mt-auto">
                        {isHost ? (
                            <button
                                onClick={handleStartGame}
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
                        ) : (
                            <div className="w-full bg-white/5 backdrop-blur border border-white/10 py-5 rounded-[1.5rem] text-center text-white/50 font-bold text-lg animate-pulse flex flex-col gap-1">
                                <span>{t("waiting_host")}</span>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
