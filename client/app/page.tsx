"use client";

import { useEffect, useState, Suspense } from "react";
import { getSocket } from "@/utils/socket";
import { useRouter, useSearchParams } from "next/navigation";
import { Tile } from "@/components/Tile";
import { useLanguage } from "@/contexts/LanguageContext";
import { soundManager } from "@/utils/soundManager";

function HomeContent() {
    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState(0); // 0-7
    const [isLoaded, setIsLoaded] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const searchParams = useSearchParams();

    // Load preferences on mount
    useEffect(() => {
        const savedName = localStorage.getItem("okey_nickname");
        const savedAvatar = localStorage.getItem("okey_avatar");
        if (savedName) setNickname(savedName);
        if (savedAvatar) setAvatarId(parseInt(savedAvatar));
        setIsLoaded(true);
    }, []);

    // Save preferences on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("okey_nickname", nickname);
            localStorage.setItem("okey_avatar", avatarId.toString());
        }
    }, [nickname, avatarId, isLoaded]);

    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const router = useRouter();
    const socket = getSocket();
    const { t, language, setLanguage } = useLanguage();

    // Expanded Human Avatars (Preserved)
    const avatars = [
        "👨🏻", "👩🏻", "👱🏻‍♂️", "👱🏻‍♀️", "🧔🏻", "👵🏻", "👴🏻", "👶🏻",
        "👨🏾", "👩🏾", "👨🏿", "👩🏿", "👨🏽", "👩🏽", "👳🏾‍♂️", "🧕🏾",
        "🤵🏻", "👰🏻", "🤴🏻", "👸🏻", "👮🏻‍♂️", "🕵🏻‍♂️", "💂🏻‍♂️", "👷🏻‍♂️",
        "👨🏻‍⚕️", "👩🏻‍⚕️", "👨🏻‍🎓", "👩🏻‍🎓", "👨🏻‍🎤", "👩🏻‍🎤", "👨🏻‍🏫", "👩🏻‍🏫",
        "👨🏻‍🏭", "👩🏻‍🏭", "👨🏻‍💻", "👩🏻‍💻", "👨🏻‍💼", "👩🏻‍💼", "👨🏻‍🔧", "👩🏻‍🔧",
        "🧙🏻‍♂️", "🧙🏻‍♀️", "🧛🏻‍♂️", "🧛🏻‍♀️", "🧟‍♂️", "🧟‍♀️", "🧞‍♂️", "🧞‍♀️",
        "🕴🏻", "🧘🏻‍♂️", "🧘🏻‍♀️", "🏄🏻‍♂️", "🏄🏻‍♀️", "🏊🏻‍♂️", "🏊🏻‍♀️", "⛹🏻‍♂️"
    ];

    // Handle Auto-Join via URL - Moved after definitions to use avatars/socket
    useEffect(() => {
        const joinCode = searchParams.get('join');
        if (joinCode && isLoaded) {
            setRoomCode(joinCode.toUpperCase());
            setActiveTab('join');

            // If we have a nickname, try to auto-join after a brief pause
            if (nickname) {
                // Small delay to ensure socket/state is ready and user sees what's happening
                const timer = setTimeout(() => {
                    console.log("Auto-joining room:", joinCode);
                    socket.emit("joinRoom", {
                        code: joinCode.toUpperCase(),
                        name: nickname,
                        avatar: avatars[avatarId] // defaults to first if not loaded yet? No, persisted one.
                    });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, isLoaded, nickname, avatarId, socket, avatars]);

    useEffect(() => {
        console.log("Socket instance:", socket.id, socket.connected);

        socket.on("roomCreated", (code: string) => {
            console.log("Room created:", code);
            router.push(`/room/${code}`);
        });

        socket.on("joinedRoom", (code: string) => {
            console.log("Joined room:", code);
            router.push(`/room/${code}`);
        });

        socket.on("error", (msg: string) => {
            console.error("Socket error:", msg);
            setError(msg);
            setTimeout(() => setError(""), 3000);
        });

        return () => {
            socket.off("roomCreated");
            socket.off("joinedRoom");
            socket.off("error");
        };
    }, [router, socket]);

    const handleCreate = () => {
        if (!nickname) {
            soundManager.play('error');
            setError(t("enter_nickname"));
            return;
        }
        soundManager.play('click');
        socket.emit("createRoom", { name: nickname, avatar: avatars[avatarId] });
    };

    const handleJoin = () => {
        if (!nickname) {
            soundManager.play('error');
            setError(t("enter_nickname"));
            return;
        }
        if (!roomCode) {
            soundManager.play('error');
            setError(t("enter_code"));
            return;
        }
        soundManager.play('click');
        socket.emit("joinRoom", { code: roomCode, name: nickname, avatar: avatars[avatarId] });
    };

    // Background Tiles - Statically defined for consistency and performance
    const bgTilesData: { color: 'red' | 'black' | 'blue' | 'yellow' | 'fake'; value: number }[] = [
        { color: 'red', value: 7 }, { color: 'black', value: 11 }, { color: 'blue', value: 1 },
        { color: 'yellow', value: 13 }, { color: 'red', value: 12 }, { color: 'blue', value: 5 },
        { color: 'black', value: 8 }, { color: 'yellow', value: 2 }, { color: 'red', value: 10 },
        { color: 'blue', value: 4 }, { color: 'black', value: 13 }, { color: 'yellow', value: 1 }
    ];

    const [tileStyles, setTileStyles] = useState<any[]>([]);

    useEffect(() => {
        const styles = bgTilesData.map((_, i) => ({
            top: `${Math.floor(Math.random() * 80) + 10}%`,
            left: `${Math.floor(Math.random() * 90) + 5}%`,
            animation: `float ${10 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
            transform: `rotate(${i * 15}deg)`
        }));
        setTileStyles(styles);
    }, []);

    // CSS Keyframes for smooth floating defined in globals.css

    return (
        // Premium Dynamic Gradient Background
        <div className="min-h-screen overflow-hidden relative flex flex-col items-center justify-center font-sans bg-[#0f0c29]">


            {/* --- Animated Mesh Gradient --- */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#24243e] via-[#302b63] to-[#0f0c29] animate-gradient-xy"></div>
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,rgba(76,29,149,0.3)_0%,transparent_50%)] animate-pulse-slow"></div>
            <div className="absolute bottom-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,rgba(236,72,153,0.2)_0%,transparent_50%)] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* --- Decorative Grid --- */}
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px] pointer-events-none"></div>

            {/* --- Language Toggle --- */}
            <div className="absolute top-6 right-6 z-50 flex gap-2">
                <button onMouseEnter={() => soundManager.play('hover')} onClick={() => { soundManager.play('click'); setLanguage('tr'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                    <img src="https://flagcdn.com/w80/tr.png" alt="TR" className="w-full h-full object-contain rounded" />
                </button>
                <button onMouseEnter={() => soundManager.play('hover')} onClick={() => { soundManager.play('click'); setLanguage('en'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                    <img src="https://flagcdn.com/w80/us.png" alt="EN" className="w-full h-full object-contain rounded" />
                </button>
            </div>

            {/* --- 101 Mode Entry (Top Left) --- */}
            <div className="absolute top-8 left-8 z-50 group">
                <div className="relative">
                    {/* Static Text with Faster Color Pulse & SVG Arrow */}
                    <div className="absolute -right-48 top-1/2 -translate-y-1/2 flex items-center gap-3 animate-color-pulse font-bold font-handwriting">
                        {/* Custom Red Arrow SVG */}
                        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-600">
                            <path d="M2 10H38M2 10L10 2M2 10L10 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xl whitespace-nowrap">101 Modu</span>
                    </div>

                    <button
                        onMouseEnter={() => soundManager.play('hover')}
                        onClick={() => { soundManager.play('click'); router.push('/101'); }}
                        className="
                            relative w-20 h-20 
                            bg-gradient-to-br from-red-600 to-rose-700 
                            text-white 
                            shadow-[0_10px_25px_rgba(220,38,38,0.5)] 
                            border-b-4 border-r-4 border-red-900 
                            hover:scale-110 active:scale-95 transition-all duration-300
                            flex items-center justify-center
                            overflow-hidden
                        "
                        style={{
                            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' // Asymmetric Blob Shape
                        }}
                    >
                        <span className="text-2xl font-black relative z-10 -rotate-12 group-hover:rotate-0 transition-transform">101</span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent translate-y-full group-hover:translate-y-[-100%] transition-transform duration-700"></div>
                    </button>

                    {/* Floating Badge */}
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-bounce">
                        YENİ
                    </div>
                </div>
            </div>

            {/* --- Animated Background Tiles --- */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {tileStyles.map((style, i) => (
                    <div
                        key={i}
                        className="absolute opacity-70 drop-shadow-2xl p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20"
                        style={style}
                    >
                        <Tile {...bgTilesData[i]} size="md" />
                    </div>
                ))}
            </div>

            <div className="z-10 w-full max-w-xl px-4 relative flex flex-col items-center">

                {/* --- Fun Logo --- */}
                <div className="mb-8 relative group cursor-default">
                    <h1 className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_8px_0_rgba(0,0,0,0.2)] transform rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                        OKEY<span className="text-yellow-300">.IO</span>
                    </h1>
                    <div className="absolute -top-6 -right-6 text-6xl animate-bounce" style={{ animationDuration: '2s' }}>🎲</div>
                    <div className="absolute -bottom-4 -left-6 text-6xl animate-pulse" style={{ animationDuration: '3s' }}>✨</div>
                </div>

                {/* --- Main Fun Card --- */}
                <div className="w-full bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-b-8 border-black/10 overflow-hidden relative">

                    {/* Header bar decoration */}
                    <div className="h-4 w-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"></div>

                    <div className="p-8">
                        {/* Error Bubble */}
                        {error && (
                            <div className="mb-4 bg-red-100 border-2 border-red-400 text-red-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 animate-bounce">
                                🛑 {error}
                            </div>
                        )}

                        {/* Step 1: Avatar & Name */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="relative group">
                                <div className="w-32 h-32 bg-sky-100 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-7xl mb-4 relative hover:scale-105 transition-transform cursor-pointer overflow-visible">
                                    {avatars[avatarId]}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-black p-2 rounded-full border-4 border-white shadow-sm text-sm font-bold">
                                    ✏️
                                </div>
                                {/* Dropdown */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white p-3 rounded-2xl shadow-xl border-2 border-gray-100 w-80 max-h-64 overflow-y-auto z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all grid grid-cols-5 gap-2 custom-scrollbar">
                                    {avatars.map((av, i) => (
                                        <button
                                            key={i}
                                            onMouseEnter={() => soundManager.play('hover')}
                                            onClick={() => { soundManager.play('click'); setAvatarId(i); }}
                                            className={`w-12 h-12 flex items-center justify-center text-3xl rounded-xl hover:bg-gray-100 transition-colors ${avatarId === i ? 'bg-sky-100 ring-2 ring-sky-300' : ''}`}
                                        >
                                            {av}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full bg-gray-50 border-b-4 border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-2xl font-black text-gray-700 placeholder-gray-300 outline-none transition-all"
                                placeholder={t("nickname_placeholder")}
                            />
                        </div>

                        {/* Step 2: Tabs */}
                        <div className="bg-gray-100 p-2 rounded-3xl flex gap-2">
                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={() => { soundManager.play('click'); setActiveTab('create'); }}
                                className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'create' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {t("create_room")}
                            </button>
                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={() => { soundManager.play('click'); setActiveTab('join'); }}
                                className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'join' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {t("join_room")}
                            </button>
                        </div>

                        {/* Step 3: Action Area */}
                        <div className="mt-8">
                            {activeTab === 'create' ? (
                                <button
                                    onMouseEnter={() => soundManager.play('hover')}
                                    onClick={handleCreate}
                                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(99,102,241,0.3)] border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3"
                                >
                                    <span>🚀</span> {t("create_room")}
                                </button>
                            ) : (
                                <div className="space-y-4 animate-scaleIn">
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        maxLength={4}
                                        placeholder="CODE"
                                        className="w-full bg-white border-4 border-indigo-100 focus:border-indigo-500 rounded-2xl px-4 py-4 text-center font-mono text-3xl font-black text-indigo-600 outline-none uppercase placeholder-indigo-100"
                                    />
                                    <button
                                        onMouseEnter={() => soundManager.play('hover')}
                                        onClick={handleJoin}
                                        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xl py-4 rounded-3xl shadow-[0_8px_16px_rgba(99,102,241,0.3)] border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 transition-all"
                                    >
                                        {t("join_room")}
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <div className="mt-8 text-white/60 font-medium opacity-50 text-xs">
                    © {new Date().getFullYear()} Okey.io
                </div>
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0f0c29] flex items-center justify-center text-white font-bold text-2xl">Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
