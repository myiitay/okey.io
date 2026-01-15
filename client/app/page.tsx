"use client";

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/utils/socket";
import { useRouter, useSearchParams } from "next/navigation";
import { Tile } from "@/components/Tile";
import { useLanguage } from "@/contexts/LanguageContext";
import { soundManager } from "@/utils/soundManager";

function HomeContent() {
    const socket = getSocket();
    const router = useRouter();
    const { t, language, setLanguage } = useLanguage();

    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState(0);
    const [theme, setTheme] = useState<'royal' | 'emerald' | 'noir' | 'wood'>('royal');
    const [isLoaded, setIsLoaded] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const searchParams = useSearchParams();

    // Reconnection State
    const [isRejoining, setIsRejoining] = useState(false);

    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [rooms, setRooms] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isBurning, setIsBurning] = useState(false);

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

    // Load preferences and Attempt Reconnection
    useEffect(() => {
        const savedName = localStorage.getItem("okey_nickname");
        const savedAvatar = localStorage.getItem("okey_avatar");
        if (savedName) setNickname(savedName);
        if (savedAvatar) setAvatarId(parseInt(savedAvatar));
        const savedTheme = localStorage.getItem("okey_theme") as any;
        if (savedTheme) setTheme(savedTheme);

        setIsLoaded(true);

        const sessionToken = localStorage.getItem("okey_session_token");
        if (sessionToken && !socket.connected) {
            setIsRejoining(true);
        }
    }, []);

    // Save preferences on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("okey_nickname", nickname);
            localStorage.setItem("okey_avatar", avatarId.toString());
            localStorage.setItem("okey_theme", theme);
        }
    }, [nickname, avatarId, theme, isLoaded]);

    // Handle Auto-Join via URL
    useEffect(() => {
        const joinCode = searchParams.get('join');
        if (joinCode && isLoaded && !isRejoining) { // Don't auto-join if trying to rejoin session
            setRoomCode(joinCode.toUpperCase());
            setActiveTab('join');

            if (nickname) {
                const timer = setTimeout(() => {
                    console.log("Auto-joining room:", joinCode);
                    socket.emit("joinRoom", {
                        code: joinCode.toUpperCase(),
                        name: nickname,
                        avatar: avatars[avatarId]
                    });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, isLoaded, nickname, avatarId, socket, avatars, isRejoining]);

    // Polling or Initial Fetch for rooms when entering Join tab
    useEffect(() => {
        if (activeTab === 'join' && isConnected) {
            socket.emit('getRooms');
        }
    }, [activeTab, isConnected]);

    // Unified Socket Connection Effect
    useEffect(() => {
        const onConnect = () => {
            console.log("Connected:", socket.id);
            setIsConnected(true);
            // Rejoin attempt
            const token = localStorage.getItem("okey_session_token");
            if (token) {
                setIsRejoining(true);
                socket.emit("rejoinGame", token);
            }
        };

        const onDisconnect = () => {
            console.log("Disconnected");
            setIsConnected(false);
        };

        // If already connected when mounting (e.g. hydration)
        if (socket.connected) {
            setIsConnected(true);
            onConnect();
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        socket.on("roomCreated", (code: string) => {
            router.push(`/room/${code}`);
        });

        socket.on("joinedRoom", (code: string) => {
            router.push(`/room/${code}`);
        });

        socket.on("sessionCreated", (token: string) => {
            localStorage.setItem("okey_session_token", token);
        });

        socket.on("rejoinSuccess", (data: { roomCode: string, state: any }) => {
            console.log("Rejoin successful to:", data.roomCode);
            setIsRejoining(false);
            router.push(`/room/${data.roomCode}`);
        });

        socket.on("roomListUpdate", (roomList: any[]) => {
            setRooms(roomList);
        });

        socket.on("forceRedirect", (path: string) => {
            localStorage.removeItem("okey_session_token");
            setIsRejoining(false);
            if (path !== '/') {
                router.push(path);
            }
        });

        socket.on("error", (msg: string) => {
            console.error("Socket error:", msg);
            if (isRejoining && (msg.includes("Session") || msg.includes("expired"))) {
                localStorage.removeItem("okey_session_token");
                setIsRejoining(false);
            }
            setError(msg);
            setTimeout(() => setError(""), 3000);
        });

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("roomCreated");
            socket.off("joinedRoom");
            socket.off("sessionCreated");
            socket.off("rejoinSuccess");
            socket.off("roomListUpdate");
            socket.off("forceRedirect");
            socket.off("error");
        };
    }, [router, socket, isRejoining]);

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

    // Background Tiles
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTileStyles(styles);
    }, []);

    const themeConfigs = {
        royal: {
            bg: "bg-[#0f0c29]",
            gradient: "from-[#24243e] via-[#302b63] to-[#0f0c29]",
            mesh: "rgba(76,29,149,0.3)",
            accent: "text-indigo-600",
            button: "from-indigo-500 to-purple-600",
            border: "border-indigo-800"
        },
        emerald: {
            bg: "bg-[#064e3b]",
            gradient: "from-[#065f46] via-[#047857] to-[#064e3b]",
            mesh: "rgba(16,185,129,0.2)",
            accent: "text-emerald-700",
            button: "from-emerald-500 to-teal-600",
            border: "border-emerald-800"
        },
        noir: {
            bg: "bg-[#111827]",
            gradient: "from-[#1f2937] via-[#111827] to-[#000000]",
            mesh: "rgba(255,255,255,0.05)",
            accent: "text-gray-900",
            button: "from-gray-700 to-gray-900",
            border: "border-black"
        },
        wood: {
            bg: "bg-[#451a03]",
            gradient: "from-[#78350f] via-[#451a03] to-[#2d0a01]",
            mesh: "rgba(251,191,36,0.1)",
            accent: "text-amber-900",
            button: "from-amber-700 to-yellow-800",
            border: "border-amber-950"
        }
    };

    const currentTheme = themeConfigs[theme];
    const [isEntering, setIsEntering] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsEntering(false), 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: "-100%" }}
                animate={isBurning ? {
                    x: "-100%",
                    transition: { duration: 0.6, ease: [0.76, 0, 0.24, 1] }
                } : { x: 0 }}
                transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                className={`h-screen w-screen overflow-hidden relative flex flex-col items-center justify-center font-sans ${currentTheme.bg}`}
            >
                {/* --- Swipe Entrance Effect (Flash only, no fire) --- */}
                {isEntering && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 bg-white/10 z-[100] pointer-events-none"
                    />
                )}
                {/* --- Texture Overlay --- */}
                <div className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay z-[1]" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/carbon-fibre.png")` }}></div>
                {theme === 'wood' && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none z-[1]" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/wood-pattern.png")` }}></div>
                )}

                {/* --- Animated Mesh Gradient --- */}
                <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradient} animate-gradient-xy`}></div>
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-pulse-slow" style={{ background: `radial-gradient(circle_farthest-corner_at_center,${currentTheme.mesh} 0%,transparent_50%)` }}></div>
                <div className="absolute bottom-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,rgba(236,72,153,0.2)_0%,transparent_50%)] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px] pointer-events-none"></div>

                {/* --- Language Toggle --- */}
                <div className="absolute top-6 right-6 z-50 flex gap-2">
                    <button onClick={() => { soundManager.play('click'); setLanguage('tr'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                        <img src="https://flagcdn.com/w80/tr.png" alt="TR" className="w-full h-full object-contain rounded" />
                    </button>
                    <button onClick={() => { soundManager.play('click'); setLanguage('en'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                        <img src="https://flagcdn.com/w80/us.png" alt="EN" className="w-full h-full object-contain rounded" />
                    </button>
                </div>

                {/* --- 101 Button - Screen Top Left (Prominent) --- */}
                <div className="absolute top-6 left-6 z-[100]">
                    <button
                        onClick={() => {
                            soundManager.play('click');
                            setIsBurning(true);
                            setTimeout(() => router.push('/101'), 600);
                        }}
                        className="relative group/101btn transform hover:scale-110 active:scale-95 transition-all duration-300"
                    >
                        {/* Wrapper for background and content with overflow hidden */}
                        <div className="relative overflow-hidden rounded-[2rem] p-1.5 shadow-[0_20px_50px_rgba(239,68,68,0.4)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-gradient-xy group-hover:scale-110 transition-transform"></div>
                            <div className="relative bg-[#0f172a] rounded-[1.8rem] px-10 py-5 flex flex-col items-center justify-center border-2 border-red-500/50 group-hover:bg-transparent transition-colors">
                                <span className="text-white font-black text-4xl tracking-tighter drop-shadow-lg leading-none">101</span>
                                <span className="text-red-500 group-hover:text-white font-bold text-[10px] tracking-[0.3em] uppercase mt-1">MODU</span>
                            </div>
                        </div>
                        {/* YENİ Tag - Now outside the overflow-hidden wrapper */}
                        <div className="absolute -top-3 -right-3 z-[110] bg-yellow-400 text-black text-[14px] font-black px-4 py-1.5 rounded-full shadow-2xl rotate-12 group-hover:rotate-0 transition-transform ring-4 ring-white/30 pointer-events-none">
                            YENİ 🔥
                        </div>
                    </button>
                </div>

                {/* --- Theme Switcher (Moved below 101 button) --- */}
                <div className="absolute top-48 left-6 z-50 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 bg-black/20 backdrop-blur-md p-3 rounded-3xl border border-white/10">
                        {(Object.keys(themeConfigs) as Array<keyof typeof themeConfigs>).map((tKey) => (
                            <button
                                key={tKey}
                                onClick={() => { soundManager.play('click'); setTheme(tKey); }}
                                className={`w-12 h-12 rounded-2xl border-2 transition-all hover:scale-110 flex items-center justify-center shadow-lg
                                ${theme === tKey ? 'border-white scale-110 ring-2 ring-white/50' : 'border-white/20'}`}
                                title={t(`theme_${tKey}`)}
                                style={{ backgroundColor: themeConfigs[tKey].bg.replace('bg-[', '').replace(']', '') }}
                            >
                                {theme === tKey && <span className="text-white text-sm">✓</span>}
                            </button>
                        ))}
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

                    {/* --- Logo --- */}
                    <div className="mb-4 relative group cursor-default">
                        <h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_8px_0_rgba(0,0,0,0.2)] transform rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                            OKEY<span className="text-yellow-300">.IO</span>
                        </h1>
                        <div className="absolute -top-4 -right-4 text-4xl animate-bounce" style={{ animationDuration: '2s' }}>🎲</div>
                        <div className="absolute -bottom-2 -left-4 text-4xl animate-pulse" style={{ animationDuration: '3s' }}>✨</div>
                    </div>

                    {/* --- Main Card --- */}
                    <div
                        className="w-full bg-white/95 backdrop-blur-sm rounded-[40px] shadow-[0_30px_70px_rgba(0,0,0,0.4)] border-b-8 border-black/10 overflow-hidden relative transition-transform duration-300 ease-out hover:[transform:rotateX(2deg)_rotateY(2deg)]"
                        style={{ perspective: '1000px' }}
                    >
                        <div className={`h-4 w-full bg-gradient-to-r ${currentTheme.button}`}></div>

                        <div className="p-6 relative">
                            {error && (
                                <div className="mb-4 bg-red-100 border-2 border-red-400 text-red-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 animate-bounce">
                                    🛑 {error}
                                </div>
                            )}

                            {isRejoining ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin text-6xl mb-4">🔄</div>
                                    <h2 className={`text-2xl font-black ${currentTheme.accent} mb-2`}>Eski Oturuma Bağlanılıyor...</h2>
                                    <p className="text-gray-500 font-medium">Lütfen bekleyin...</p>
                                </div>
                            ) : (
                                <>
                                    {!isConnected && (
                                        <div className="mb-4 bg-yellow-100 border-2 border-yellow-400 text-yellow-700 px-4 py-3 rounded-2xl font-bold flex items-center gap-2">
                                            📡 Sunucuya bağlanılıyor...
                                        </div>
                                    )}

                                    {/* --- Inputs --- */}
                                    <div className="flex flex-col items-center mb-6">
                                        <div className="relative group/avatar">
                                            <div className={`w-24 h-24 bg-white rounded-full border-4 ${theme === 'noir' ? 'border-gray-800' : 'border-white'} shadow-xl flex items-center justify-center text-5xl mb-3 relative hover:scale-110 transition-transform cursor-pointer overflow-visible ring-4 ${theme === 'wood' ? 'ring-amber-900/20' : 'ring-indigo-500/10'}`}>
                                                {avatars[avatarId]}
                                                {/* Frame Decoration */}
                                                <div className={`absolute inset-[-8px] border-2 rounded-full opacity-50 ${theme === 'royal' ? 'border-indigo-400' : theme === 'emerald' ? 'border-emerald-400' : theme === 'wood' ? 'border-amber-600' : 'border-gray-400 animate-pulse'}`}></div>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-black p-2 rounded-full border-4 border-white shadow-sm text-sm font-bold z-10">
                                                ✏️
                                            </div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white p-3 rounded-2xl shadow-2xl border-2 border-gray-100 w-80 max-h-64 overflow-y-auto z-[100] opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all grid grid-cols-5 gap-2 custom-scrollbar">
                                                {avatars.map((av, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => { soundManager.play('click'); setAvatarId(i); }}
                                                        className={`w-12 h-12 flex items-center justify-center text-3xl rounded-xl hover:bg-gray-100 transition-colors ${avatarId === i ? 'bg-indigo-50 ring-2 ring-indigo-400 shadow-inner' : ''}`}
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

                                    <div className="bg-gray-100/80 p-2 rounded-3xl flex gap-2">
                                        <button
                                            onClick={() => { soundManager.play('click'); setActiveTab('create'); }}
                                            className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'create' ? `bg-white ${currentTheme.accent} shadow-md` : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {t("create_room")}
                                        </button>
                                        <button
                                            onClick={() => { soundManager.play('click'); setActiveTab('join'); }}
                                            className={`flex-1 py-3 rounded-2xl font-bold text-lg transition-all ${activeTab === 'join' ? `bg-white ${currentTheme.accent} shadow-md` : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {t("join_room")}
                                        </button>
                                    </div>

                                    <div className="mt-8">
                                        {activeTab === 'create' ? (
                                            <div className="space-y-4">
                                                <button
                                                    onClick={handleCreate}
                                                    disabled={!isConnected}
                                                    className={`w-full bg-gradient-to-r ${currentTheme.button} hover:brightness-110 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] border-b-8 ${currentTheme.border} active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3 ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <span>🚀</span> {t("create_room")}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-6 animate-scaleIn">
                                                {/* Code Input Section */}
                                                <div className="space-y-4">
                                                    <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">KOD İLE GİR</div>
                                                    <div className="flex flex-col gap-3">
                                                        <input
                                                            type="text"
                                                            value={roomCode}
                                                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                                            maxLength={4}
                                                            placeholder={t("room_code")}
                                                            className={`w-full bg-white border-4 border-gray-100 focus:border-indigo-500 rounded-2xl px-4 py-4 text-center font-mono text-3xl font-black ${currentTheme.accent} outline-none uppercase placeholder-gray-100 transition-all`}
                                                        />
                                                        <button
                                                            onClick={handleJoin}
                                                            disabled={!isConnected}
                                                            className={`w-full bg-gradient-to-r ${currentTheme.button} hover:brightness-110 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] border-b-8 ${currentTheme.border} active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3 ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <span>📥</span> {t("join_room")}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                        <div className="w-full border-t border-gray-200"></div>
                                                    </div>
                                                    <div className="relative flex justify-center">
                                                        <span className="bg-white px-3 text-xs font-bold text-gray-400 uppercase tracking-widest">VEYA MEVCUT OYUNLAR</span>
                                                    </div>
                                                </div>

                                                {/* Lobby List Section */}
                                                <div className="space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                                                    {rooms.length === 0 ? (
                                                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                                            <div className="text-4xl mb-2">📭</div>
                                                            <p className="font-bold text-sm">Aktif oda bulunamadı</p>
                                                        </div>
                                                    ) : (
                                                        rooms.map((room) => (
                                                            <div key={room.id} className="bg-white border-2 border-indigo-100 rounded-2xl p-3 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-md transform group-hover:scale-110 transition-transform ${room.mode === '101' ? 'bg-red-500' : 'bg-indigo-500'}`}>
                                                                        {room.mode === '101' ? '101' : '🎲'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-gray-700 font-mono text-xl leading-none">
                                                                            #{room.id}
                                                                        </div>
                                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mt-1">
                                                                            {room.status === 'Playing' ? '🟡 OYNANIYOR' : '🟢 BEKLENİYOR'}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-xl">
                                                                        <span className="text-xs">👤</span>
                                                                        <span className="text-xs font-black text-gray-600">{room.count}/{room.max}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setRoomCode(room.id);
                                                                            soundManager.play('click');
                                                                            socket.emit("joinRoom", { code: room.id, name: nickname, avatar: avatars[avatarId] });
                                                                        }}
                                                                        disabled={!isConnected || room.count >= room.max || room.status === 'Playing'}
                                                                        className={`px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-sm transition-all active:scale-95 ${room.count >= room.max || room.status === 'Playing' ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600 hover:shadow-lg'}`}
                                                                    >
                                                                        KATIL
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 text-white/60 font-medium opacity-50 text-xs text-center">
                        © {new Date().getFullYear()} Okey.io
                    </div>
                </div>
            </motion.div >
        </AnimatePresence >
    );
}
export default function Home() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0f0c29] flex items-center justify-center text-white font-bold text-2xl">...</div>}>
            <HomeContent />
        </Suspense>
    );
}
