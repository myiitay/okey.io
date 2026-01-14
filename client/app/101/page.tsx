"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/utils/socket";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/Tile";
import { soundManager } from "@/utils/soundManager";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Page101() {
    const { t, language, setLanguage } = useLanguage();
    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState(0);
    const [theme, setTheme] = useState<'royal' | 'emerald' | 'noir' | 'wood'>('royal');
    const [isLoaded, setIsLoaded] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [isBurning, setIsBurning] = useState(false);
    const router = useRouter();
    const socket = getSocket();

    // Load preferences
    useEffect(() => {
        const savedName = localStorage.getItem("okey_nickname");
        const savedAvatar = localStorage.getItem("okey_avatar");
        const savedTheme = localStorage.getItem("okey_theme") as any;
        if (savedName) setNickname(savedName);
        if (savedAvatar) setAvatarId(parseInt(savedAvatar));
        if (savedTheme) setTheme(savedTheme);
        setIsLoaded(true);
    }, []);

    // Save preferences
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("okey_nickname", nickname);
            localStorage.setItem("okey_avatar", avatarId.toString());
            localStorage.setItem("okey_theme", theme);
        }
    }, [nickname, avatarId, theme, isLoaded]);

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
            router.push(`/room/${code}`);
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
    }, [router, socket]);

    const handleCreate = () => {
        if (!nickname) {
            soundManager.play('error');
            setError("İsim girin");
            return;
        }
        soundManager.play('click');
        socket.emit("createRoom", { name: nickname, avatar: avatars[avatarId], gameMode: '101' });
    };

    const handleJoin = () => {
        if (!nickname) {
            soundManager.play('error');
            setError("İsim girin");
            return;
        }
        if (!roomCode) {
            soundManager.play('error');
            setError("Kod girin");
            return;
        }
        soundManager.play('click');
        socket.emit("joinRoom", { code: roomCode, name: nickname, avatar: avatars[avatarId] });
    };

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

    const themeConfigs = {
        royal: {
            bg: "bg-[#0b0e14]",
            gradient: "from-[#1e1b4b] via-[#312e81] to-[#1e1b4b]",
            mesh: "rgba(99,102,241,0.2)",
            accent: "text-indigo-600",
            button: "from-indigo-600 to-purple-700",
            border: "border-indigo-900"
        },
        emerald: {
            bg: "bg-[#061c14]",
            gradient: "from-[#064e3b] via-[#065f46] to-[#064e3b]",
            mesh: "rgba(16,185,129,0.2)",
            accent: "text-emerald-600",
            button: "from-emerald-600 to-teal-700",
            border: "border-emerald-950"
        },
        noir: {
            bg: "bg-[#0a0a0a]",
            gradient: "from-[#171717] via-[#262626] to-[#171717]",
            mesh: "rgba(255,255,255,0.05)",
            accent: "text-white",
            button: "from-zinc-800 to-zinc-950",
            border: "border-black"
        },
        wood: {
            bg: "bg-[#2d1a12]",
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
                initial={{ x: "100%" }}
                animate={isBurning ? {
                    x: "100%",
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

                {/* --- Theme Switcher --- */}
                <div className="absolute top-48 right-6 z-50 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 bg-black/20 backdrop-blur-md p-3 rounded-3xl border border-white/10">
                        {(Object.keys(themeConfigs) as Array<keyof typeof themeConfigs>).map((tKey) => (
                            <button
                                key={tKey}
                                onMouseEnter={() => soundManager.play('hover')}
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

                {/* --- Language Toggle --- */}
                <div className="absolute top-6 right-6 z-50 flex gap-2">
                    <button onClick={() => { soundManager.play('click'); setLanguage('tr'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                        <img src="https://flagcdn.com/w80/tr.png" alt="TR" className="w-full h-full object-contain rounded" />
                    </button>
                    <button onClick={() => { soundManager.play('click'); setLanguage('en'); }} className="w-12 h-12 rounded-2xl border-white/20 border-2 bg-white/10 hover:bg-white/30 backdrop-blur-md transition-all hover:scale-110 flex items-center justify-center p-1 shadow-lg">
                        <img src="https://flagcdn.com/w80/us.png" alt="EN" className="w-full h-full object-contain rounded" />
                    </button>
                </div>

                {/* --- Standart Mod Button - Screen Top Left (Prominent) --- */}
                <div className="absolute top-6 left-6 z-[100]">
                    <button
                        onClick={() => {
                            soundManager.play('click');
                            setIsBurning(true);
                            setTimeout(() => router.push('/'), 600);
                        }}
                        className="relative group/stdbtn overflow-hidden rounded-[2rem] p-1.5 shadow-[0_20px_50px_rgba(79,70,229,0.4)] transform hover:scale-110 active:scale-95 transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-600 animate-gradient-xy group-hover:scale-110 transition-transform"></div>
                        <div className="relative bg-[#0f172a] rounded-[1.8rem] px-10 py-5 flex flex-col items-center justify-center border-2 border-indigo-500/50 group-hover:bg-transparent transition-colors">
                            <span className="text-white font-black text-3xl tracking-tighter drop-shadow-lg leading-none">STANDART</span>
                            <span className="text-indigo-400 group-hover:text-white font-bold text-[10px] tracking-[0.3em] uppercase mt-1">MOD</span>
                        </div>
                    </button>
                </div>

                {/* Animated Background Tiles */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    {tileStyles.map((style, i) => (
                        <div key={i} className="absolute opacity-70 drop-shadow-2xl p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20" style={style}>
                            <Tile {...bgTilesData[i]} size="md" />
                        </div>
                    ))}
                </div>

                <div className="z-10 w-full max-w-xl px-4 relative flex flex-col items-center">

                    {/* Logo */}
                    <div className="mb-4 relative group cursor-default">
                        <h1 className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_8px_0_rgba(0,0,0,0.2)] transform rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                            OKEY<span className="text-red-500">.IO</span>
                        </h1>
                        <div className="absolute -top-6 -right-6 text-6xl animate-bounce" style={{ animationDuration: '2s' }}>🔥</div>
                        <div className="absolute -bottom-4 -left-6 text-6xl animate-pulse" style={{ animationDuration: '3s' }}>✨</div>
                    </div>

                    {/* Main Card */}
                    <div
                        className="w-full bg-white/95 backdrop-blur-sm rounded-[40px] shadow-[0_30px_70px_rgba(0,0,0,0.4)] border-b-8 border-black/10 overflow-hidden relative transition-transform duration-300 ease-out hover:[transform:rotateX(2deg)_rotateY(2deg)]"
                        style={{ perspective: '1000px' }}
                    >

                        {/* Header bar - RED THEME */}
                        <div className="h-4 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600"></div>

                        <div className="p-8">
                            {error && (
                                <div className="mb-4 bg-red-100 border-2 border-red-400 text-red-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 animate-bounce">
                                    🛑 {error}
                                </div>
                            )}

                            {/* Avatar & Name */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative group/avatar">
                                    <div className={`w-32 h-32 bg-white rounded-full border-4 ${theme === 'noir' ? 'border-gray-800' : 'border-white'} shadow-xl flex items-center justify-center text-7xl mb-4 relative hover:scale-105 transition-transform cursor-pointer overflow-visible ring-4 ${theme === 'wood' ? 'ring-amber-900/20' : 'ring-red-500/10'}`}>
                                        {avatars[avatarId]}
                                        {/* Frame Decoration */}
                                        <div className={`absolute inset-[-8px] border-2 rounded-full opacity-50 ${theme === 'royal' ? 'border-indigo-400' : theme === 'emerald' ? 'border-emerald-400' : theme === 'wood' ? 'border-amber-600' : 'border-red-400 animate-pulse'}`}></div>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-red-500 text-white p-2 rounded-full border-4 border-white shadow-sm text-sm font-bold">
                                        ✏️
                                    </div>
                                    {/* Dropdown */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white p-3 rounded-2xl shadow-xl border-2 border-gray-100 w-80 max-h-64 overflow-y-auto z-[100] opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all grid grid-cols-5 gap-2 custom-scrollbar">
                                        {avatars.map((av, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { soundManager.play('click'); setAvatarId(i); }}
                                                className={`w-12 h-12 flex items-center justify-center text-3xl rounded-xl hover:bg-gray-100 transition-colors ${avatarId === i ? 'bg-red-50 ring-2 ring-red-300 shadow-inner' : ''}`}
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
                                    className="w-full bg-gray-50 border-b-4 border-gray-200 focus:border-red-500 rounded-xl px-4 py-4 text-center text-2xl font-black text-gray-700 placeholder-gray-300 outline-none transition-all"
                                    placeholder={t("nickname_placeholder") || "İsmini Gir"}
                                />
                            </div>

                            {/* Tabs */}
                            <div className="bg-gray-100/80 p-2 rounded-3xl flex gap-2 mb-6">
                                <button
                                    onClick={() => { soundManager.play('click'); setActiveTab('create'); }}
                                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${activeTab === 'create' ? 'bg-white text-red-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    🎲 {t("create_room")}
                                </button>
                                <button
                                    onClick={() => { soundManager.play('click'); setActiveTab('join'); }}
                                    className={`flex-1 py-3 rounded-2xl font-bold transition-all ${activeTab === 'join' ? 'bg-white text-red-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    🚪 {t("join_room")}
                                </button>
                            </div>

                            {/* Content */}
                            {activeTab === 'create' ? (
                                <button
                                    onMouseEnter={() => soundManager.play('hover')}
                                    onClick={handleCreate}
                                    className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(220,38,38,0.2)] border-b-8 border-red-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3"
                                >
                                    🚀 {t("create_room")}
                                </button>
                            ) : (
                                <div className="space-y-6 animate-scaleIn">
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                        placeholder={t("room_code_placeholder") || "ODA KODU"}
                                        className="w-full text-center text-3xl font-black border-b-4 border-gray-200 focus:border-red-500 rounded-xl px-6 py-6 outline-none transition-all uppercase text-gray-700 bg-gray-50"
                                        maxLength={6}
                                    />
                                    <button
                                        onClick={handleJoin}
                                        className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(220,38,38,0.2)] border-b-8 border-red-800 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center gap-3"
                                    >
                                        🚀 {t("join_room")}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-8 text-white/60 font-medium opacity-50 text-xs text-center">
                    © {new Date().getFullYear()} Okey.io
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
