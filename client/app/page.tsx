"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/utils/socket";
import { useRouter, useSearchParams } from "next/navigation";
import { Tile } from "@/components/Tile";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState(0); // 0-7
    const [isLoaded, setIsLoaded] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const [gameMode, setGameMode] = useState<'standard' | '101'>('standard');
    const searchParams = useSearchParams();

    // Load preferences on mount
    useEffect(() => {
        const savedName = localStorage.getItem("okey_nickname");
        const savedAvatar = localStorage.getItem("okey_avatar");
        const savedMode = localStorage.getItem("okey_mode") as 'standard' | '101';
        if (savedName) setNickname(savedName);
        if (savedAvatar) setAvatarId(parseInt(savedAvatar));
        if (savedMode) setGameMode(savedMode);
        setIsLoaded(true);
    }, []);

    // Save preferences on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("okey_nickname", nickname);
            localStorage.setItem("okey_avatar", avatarId.toString());
            localStorage.setItem("okey_mode", gameMode);
        }
    }, [nickname, avatarId, gameMode, isLoaded]);

    // Handle Auto-Join via URL
    useEffect(() => {
        const joinCode = searchParams.get('join');
        const joinMode = searchParams.get('mode') as 'standard' | '101';
        if (joinCode && isLoaded) {
            setRoomCode(joinCode.toUpperCase());
            setActiveTab('join');
            if (joinMode) setGameMode(joinMode);

            if (nickname) {
                const timer = setTimeout(() => {
                    socket.emit("joinRoom", {
                        code: joinCode.toUpperCase(),
                        name: nickname,
                        avatar: avatars[avatarId]
                    });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, isLoaded, nickname, avatarId]);

    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const router = useRouter();
    const socket = getSocket();
    const { t, language, setLanguage } = useLanguage();

    const avatars = [
        "👨🏻", "👩🏻", "👱🏻‍♂️", "👱🏻‍♀️", "🧔🏻", "👵🏻", "👴🏻", "👶🏻",
        "👨🏾", "👩🏾", "👨🏿", "👩🏿", "👨🏽", "👩🏽", "👳🏾‍♂️", "🧕🏾",
        "🤵🏻", "👰🏻", "🤴🏻", "👸🏻", "👮🏻‍♂️", "🕵🏻‍♂️", "💂🏻‍♂️", "👷🏻‍♂️",
        "👨🏻‍⚕️", "👩🏻‍⚕️", "👨🏻‍🎓", "👩🏻‍🎓", "👨🏻‍🎤", "👩🏻‍🎤", "👨🏻‍🏫", "👩🏻‍🏫",
        "👨🏻‍🏭", "👩🏻‍🏭", "👨🏻‍💻", "👩🏻‍💻", "👨🏻‍💼", "👩🏻‍💼", "👨🏻‍🔧", "👩🏻‍🔧",
        "🧙🏻‍♂️", "🧙🏻‍♀️", "🧛🏻‍♂️", "🧛🏻‍♀️", "🧟‍♂️", "🧟‍♀️", "🧞‍♂️", "🧞‍♀️",
        "🕴🏻", "🧘🏻‍♂️", "🧘🏻‍♀️", "🏄🏻‍♂️", "🏄🏻‍♀️", "🏊🏻‍♂️", "🏊🏻‍♀️", "⛹🏻‍♂️"
    ];

    useEffect(() => {
        socket.on("roomCreated", (code: string) => {
            router.push(`/room/${code}?mode=${gameMode}`);
        });

        socket.on("joinedRoom", (code: string) => {
            router.push(`/room/${code}`);
        });

        socket.on("error", (msg: string) => {
            setError(msg);
            setTimeout(() => setError(""), 3000);
        });

        return () => {
            socket.off("roomCreated");
            socket.off("joinedRoom");
            socket.off("error");
        };
    }, [router, socket, gameMode]);

    const handleCreate = () => {
        if (!nickname) {
            setError(t("enter_nickname"));
            return;
        }
        socket.emit("createRoom", { name: nickname, avatar: avatars[avatarId], mode: gameMode });
    };

    const handleJoin = () => {
        if (!nickname) {
            setError(t("enter_nickname"));
            return;
        }
        if (!roomCode) {
            setError(t("enter_code"));
            return;
        }
        socket.emit("joinRoom", { code: roomCode, name: nickname, avatar: avatars[avatarId] });
    };

    const bgTilesData: { color: 'red' | 'black' | 'blue' | 'yellow' | 'fake'; value: number }[] = [
        { color: 'red', value: 101 % 13 || 13 }, { color: 'black', value: 11 }, { color: 'blue', value: 1 },
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

    const floatAnimation = `
        @keyframes float {
            0% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(30px, -50px) rotate(10deg); }
            66% { transform: translate(-20px, 20px) rotate(-5deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes bounce-horizontal {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-10px); }
        }
        .animate-bounce-horizontal {
            animation: bounce-horizontal 1s infinite;
        }
        .mode-transition {
            transition: all 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
    `;

    return (
        <div className={`min-h-screen overflow-hidden relative flex flex-col items-center justify-center font-sans mode-transition ${gameMode === 'standard' ? 'bg-[#0f0c29]' : 'bg-[#1a0505]'}`}>
            <style jsx global>{floatAnimation}</style>

            {/* --- Animated Mesh Gradient --- */}
            <div className={`absolute inset-0 mode-transition bg-gradient-to-br transition-opacity duration-1000 ${gameMode === 'standard'
                ? 'from-[#24243e] via-[#302b63] to-[#0f0c29]'
                : 'from-[#2b0303] via-[#4a0404] to-[#1a0505]'
                }`}></div>

            <div className={`absolute top-[-50%] left-[-50%] w-[200%] h-[200%] mode-transition animate-pulse-slow ${gameMode === 'standard'
                ? 'bg-[radial-gradient(circle_farthest-corner_at_center,rgba(76,29,149,0.3)_0%,transparent_50%)]'
                : 'bg-[radial-gradient(circle_farthest-corner_at_center,rgba(153,27,27,0.3)_0%,transparent_50%)]'
                }`}></div>

            {/* --- Decorative Grid --- */}
            <div className={`absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px] pointer-events-none`}></div>

            {/* --- TOP BAR (Language & Mode) --- */}
            <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
                {/* Mode Toggle */}
                <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-2xl">
                    <button
                        onClick={() => setGameMode('standard')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${gameMode === 'standard' ? 'bg-white text-indigo-900 shadow-lg' : 'text-white/40 hover:text-white'}`}
                    >
                        STANDART
                    </button>
                    <button
                        onClick={() => setGameMode('101')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${gameMode === '101' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'text-white/40 hover:text-white'}`}
                    >
                        101 OKEY
                        {gameMode === 'standard' && (
                            <div className="absolute left-[110%] top-1/2 -translate-y-1/2 flex items-center gap-2 animate-bounce-horizontal pointer-events-none">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-red-500">
                                    <path d="M19 12H5M5 12L11 6M5 12L11 18" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] whitespace-nowrap">101 BURADA!</span>
                            </div>
                        )}
                    </button>
                </div>

                {/* Language */}
                <div className="flex gap-2">
                    <button onClick={() => setLanguage('tr')} className="w-10 h-10 rounded-xl border-white/10 border bg-white/5 hover:bg-white/20 backdrop-blur-md transition-all flex items-center justify-center p-1">
                        <img src="https://flagcdn.com/w80/tr.png" alt="TR" className="w-full h-full object-contain rounded-sm" />
                    </button>
                    <button onClick={() => setLanguage('en')} className="w-10 h-10 rounded-xl border-white/10 border bg-white/5 hover:bg-white/20 backdrop-blur-md transition-all flex items-center justify-center p-1">
                        <img src="https://flagcdn.com/w80/us.png" alt="EN" className="w-full h-full object-contain rounded-sm" />
                    </button>
                </div>
            </div>

            {/* --- Animated Background Tiles --- */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {tileStyles.map((style, i) => (
                    <div
                        key={i}
                        className={`absolute opacity-70 drop-shadow-2xl p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 mode-transition ${gameMode === '101' ? 'sepia hue-rotate-[320deg] brightness-75' : ''}`}
                        style={style}
                    >
                        <Tile {...bgTilesData[i]} size="md" />
                    </div>
                ))}
            </div>

            <div className="z-10 w-full max-w-xl px-4 relative flex flex-col items-center">

                {/* --- Fun Logo --- */}
                <div className="mb-8 relative group cursor-default text-center">
                    <h1 className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_8px_0_rgba(0,0,0,0.2)] transform rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                        OKEY<span className={`${gameMode === 'standard' ? 'text-yellow-300' : 'text-red-500'}`}>.IO</span>
                    </h1>
                    <div className="absolute -top-6 -right-6 text-6xl animate-bounce" style={{ animationDuration: '2s' }}>
                        {gameMode === 'standard' ? '🎲' : '🔥'}
                    </div>
                    <div className="absolute -bottom-4 -left-6 text-6xl animate-pulse" style={{ animationDuration: '3s' }}>
                        {gameMode === 'standard' ? '✨' : '🌋'}
                    </div>
                </div>

                {/* --- Main Fun Card --- */}
                <div className={`w-full bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-b-8 border-black/10 overflow-hidden relative transition-all duration-1000 ${gameMode === '101' ? 'ring-4 ring-red-500/50' : ''}`}>

                    {/* Header bar decoration */}
                    <div className={`h-4 w-full mode-transition ${gameMode === 'standard' ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400' : 'bg-gradient-to-r from-red-600 via-black to-red-600'}`}></div>

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
                                <div className={`w-32 h-32 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-7xl mb-4 relative hover:scale-105 transition-all cursor-pointer overflow-visible ${gameMode === 'standard' ? 'bg-sky-100' : 'bg-red-50'}`}>
                                    {avatars[avatarId]}
                                </div>
                                <div className={`absolute -bottom-2 -right-2 p-2 rounded-full border-4 border-white shadow-sm text-sm font-bold transition-colors ${gameMode === 'standard' ? 'bg-yellow-400 text-black' : 'bg-red-600 text-white'}`}>
                                    ✏️
                                </div>
                                {/* Dropdown */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white p-3 rounded-2xl shadow-2xl border-2 border-gray-100 w-80 max-h-64 overflow-y-auto z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all grid grid-cols-5 gap-2 custom-scrollbar">
                                    {avatars.map((av, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setAvatarId(i)}
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
                                className={`w-full bg-gray-50 border-b-4 focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-2xl font-black text-gray-700 placeholder-gray-300 outline-none transition-all ${gameMode === 'standard' ? 'border-gray-200' : 'border-red-200'}`}
                                placeholder={t("nickname_placeholder")}
                            />
                        </div>

                        {/* Step 2: Tabs */}
                        <div className="bg-gray-100 p-2 rounded-3xl flex gap-2">
                            <button
                                onClick={() => setActiveTab('create')}
                                className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'create' ? (gameMode === 'standard' ? 'bg-white text-indigo-600 shadow-md' : 'bg-red-600 text-white shadow-lg') : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {t("create_room")}
                            </button>
                            <button
                                onClick={() => setActiveTab('join')}
                                className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'join' ? (gameMode === 'standard' ? 'bg-white text-indigo-600 shadow-md' : 'bg-red-600 text-white shadow-lg') : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {t("join_room")}
                            </button>
                        </div>

                        {/* Step 3: Action Area */}
                        <div className="mt-8">
                            {activeTab === 'create' ? (
                                <button
                                    onClick={handleCreate}
                                    className={`w-full text-white font-black text-2xl py-6 rounded-3xl active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3 ${gameMode === 'standard'
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-[0_10px_20px_rgba(99,102,241,0.3)] border-b-8 border-indigo-800'
                                        : 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 shadow-[0_10px_20px_rgba(220,38,38,0.3)] border-b-8 border-red-950'
                                        }`}
                                >
                                    <span>{gameMode === 'standard' ? '🚀' : '☄️'}</span> {t("create_room")}
                                </button>
                            ) : (
                                <div className="space-y-4 animate-scaleIn">
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        maxLength={4}
                                        placeholder="CODE"
                                        className={`w-full bg-white border-4 rounded-2xl px-4 py-4 text-center font-mono text-3xl font-black outline-none uppercase transition-colors ${gameMode === 'standard' ? 'border-indigo-100 focus:border-indigo-500 text-indigo-600 placeholder-indigo-100' : 'border-red-100 focus:border-red-500 text-red-600 placeholder-red-100'
                                            }`}
                                    />
                                    <button
                                        onClick={handleJoin}
                                        className={`w-full text-white font-black text-xl py-4 rounded-3xl active:border-b-0 active:translate-y-2 transition-all ${gameMode === 'standard'
                                            ? 'bg-indigo-500 hover:bg-indigo-600 shadow-[0_8px_16px_rgba(99,102,241,0.3)] border-b-8 border-indigo-800'
                                            : 'bg-red-600 hover:bg-red-700 shadow-[0_8px_16px_rgba(220,38,38,0.3)] border-b-8 border-red-950'
                                            }`}
                                    >
                                        {t("join_room")}
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <div className="mt-8 text-white/60 font-medium opacity-50 text-xs flex gap-4">
                    <span>© {new Date().getFullYear()} Okey.io</span>
                    {gameMode === '101' && <span className="text-red-500 font-black animate-pulse">VOİD UNİVERSE ACTIVATED</span>}
                </div>
            </div>
        </div>
    );
}
