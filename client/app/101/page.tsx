"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/utils/socket";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/Tile";
import { soundManager } from "@/utils/soundManager";

export default function Page101() {
    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const router = useRouter();
    const socket = getSocket();

    // Load preferences
    useEffect(() => {
        const savedName = localStorage.getItem("okey_nickname");
        const savedAvatar = localStorage.getItem("okey_avatar");
        if (savedName) setNickname(savedName);
        if (savedAvatar) setAvatarId(parseInt(savedAvatar));
        setIsLoaded(true);
    }, []);

    // Save preferences
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("okey_nickname", nickname);
            localStorage.setItem("okey_avatar", avatarId.toString());
        }
    }, [nickname, avatarId, isLoaded]);

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

    return (
        <div className="min-h-screen overflow-hidden relative flex flex-col items-center justify-center font-sans bg-[#2a0808]">

            {/* Animated Mesh Gradient - RED THEME */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#450a0a] via-[#7f1d1d] to-[#2a0808] animate-gradient-xy"></div>
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,rgba(220,38,38,0.3)_0%,transparent_50%)] animate-pulse-slow"></div>
            <div className="absolute bottom-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,rgba(239,68,68,0.2)_0%,transparent_50%)] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* Decorative Grid */}
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px] pointer-events-none"></div>

            {/* Standard Mode Entry (Top Left) */}
            <div className="absolute top-8 left-8 z-50 group">
                <div className="relative">
                    <div className="absolute -right-56 top-1/2 -translate-y-1/2 flex items-center gap-3 animate-color-pulse font-bold font-handwriting">
                        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-400">
                            <path d="M2 10H38M2 10L10 2M2 10L10 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xl whitespace-nowrap text-indigo-400">Standart Mod</span>
                    </div>

                    <button
                        onMouseEnter={() => soundManager.play('hover')}
                        onClick={() => { soundManager.play('click'); router.push('/'); }}
                        className="relative w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-[0_10px_25px_rgba(79,70,229,0.5)] border-b-4 border-r-4 border-indigo-900 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center overflow-hidden"
                        style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
                    >
                        <span className="text-sm font-black relative z-10 -rotate-12 group-hover:rotate-0 transition-transform">Standart</span>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent translate-y-full group-hover:translate-y-[-100%] transition-transform duration-700"></div>
                    </button>
                </div>
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
                <div className="mb-8 relative group cursor-default">
                    <h1 className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_8px_0_rgba(0,0,0,0.2)] transform rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                        OKEY<span className="text-red-500">.IO</span>
                    </h1>
                    <div className="absolute -top-6 -right-6 text-6xl animate-bounce" style={{ animationDuration: '2s' }}>🔥</div>
                    <div className="absolute -bottom-4 -left-6 text-6xl animate-pulse" style={{ animationDuration: '3s' }}>✨</div>
                </div>

                {/* Main Card */}
                <div className="w-full bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-b-8 border-black/10 overflow-hidden relative">

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
                            <div className="relative group">
                                <div className="w-32 h-32 bg-red-100 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-7xl mb-4 relative hover:scale-105 transition-transform cursor-pointer overflow-visible">
                                    {avatars[avatarId]}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-red-500 text-white p-2 rounded-full border-4 border-white shadow-sm text-sm font-bold">
                                    ✏️
                                </div>
                                {/* Dropdown */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white p-3 rounded-2xl shadow-xl border-2 border-gray-100 w-80 max-h-64 overflow-y-auto z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all grid grid-cols-5 gap-2 custom-scrollbar">
                                    {avatars.map((av, i) => (
                                        <button
                                            key={i}
                                            onMouseEnter={() => soundManager.play('hover')}
                                            onClick={() => { soundManager.play('click'); setAvatarId(i); }}
                                            className={`w-12 h-12 flex items-center justify-center text-3xl rounded-xl hover:bg-gray-100 transition-colors ${avatarId === i ? 'bg-red-100 ring-2 ring-red-300' : ''}`}
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
                                placeholder="İsmini Gir"
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={() => { soundManager.play('click'); setActiveTab('create'); }}
                                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${activeTab === 'create' ? 'bg-red-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                🎲 Oda Oluştur
                            </button>
                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={() => { soundManager.play('click'); setActiveTab('join'); }}
                                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${activeTab === 'join' ? 'bg-red-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                🚪 Odaya Katıl
                            </button>
                        </div>

                        {/* Content */}
                        {activeTab === 'create' ? (
                            <button
                                onMouseEnter={() => soundManager.play('hover')}
                                onClick={handleCreate}
                                className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black text-xl py-5 rounded-3xl shadow-[0_8px_0_rgba(220,38,38,0.4)] hover:shadow-[0_4px_0_rgba(220,38,38,0.4)] active:translate-y-1 transition-all"
                            >
                                🎉 BAŞLAT!
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    placeholder="ODA KODU"
                                    className="w-full text-center text-2xl font-bold border-4 border-gray-200 rounded-3xl px-6 py-4 focus:outline-none focus:border-red-500 transition-all uppercase text-black placeholder-gray-400"
                                    maxLength={6}
                                />
                                <button
                                    onMouseEnter={() => soundManager.play('hover')}
                                    onClick={handleJoin}
                                    className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black text-xl py-5 rounded-3xl shadow-[0_8px_0_rgba(220,38,38,0.4)] hover:shadow-[0_4px_0_rgba(220,38,38,0.4)] active:translate-y-1 transition-all"
                                >
                                    🚀 KATIL!
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
