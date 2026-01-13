import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

import { soundManager } from '@/utils/soundManager';

interface Message {
    text: string;
    sender: string;
    avatar: string;
    time: string;
    isSystem?: boolean;
}

export const Chat: React.FC<{ socket: Socket }> = ({ socket }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isOpen, setIsOpen] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        socket.on("chatMessage", (msg: Message) => {
            setMessages(prev => [...prev, msg]);
            soundManager.play('chat');
        });

        return () => {
            socket.off('chatMessage');
        };
    }, [socket]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        socket.emit('sendMessage', input);
        setInput("");
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="absolute bottom-64 right-4 z-[90] w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/80 hover:bg-black/60 transition-all border border-white/10"
                title="Sohbeti Aç"
            >
                💬
            </button>
        );
    }

    return (
        <div className="absolute bottom-64 right-4 z-[90] w-72 h-64 flex flex-col pointer-events-none">
            {/* Messages Container - Much more transparent */}
            <div className={`
                flex-1
                bg-black/55 backdrop-blur-[2px] border border-white/5 rounded-2xl shadow-lg
                flex flex-col overflow-hidden pointer-events-auto
                transition-all duration-300
            `}>
                {/* Header - Minimal with Toggle */}
                <div className="bg-white/5 p-2 px-3 border-b border-white/5 font-bold text-white/50 text-xs flex justify-between items-center select-none group">
                    <div className="flex items-center gap-2">
                        <span>Sohbet</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 animate-pulse"></span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-white/30 hover:text-white/80 transition-colors"
                        title="Gizle"
                    >
                        ✖
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 
                    scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent scrollbar-thumb-rounded-full hover:scrollbar-thumb-white/40
                    [&::-webkit-scrollbar]:w-1.5
                    [&::-webkit-scrollbar-track]:bg-transparent
                    [&::-webkit-scrollbar-thumb]:bg-white/20
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    [&::-webkit-scrollbar-thumb]:hover:bg-white/40"
                >
                    {messages.length === 0 && (
                        <div className="text-center text-white/10 text-[10px] mt-4 italic">
                            Sohbet...
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.isSystem ? 'items-center' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            {!msg.isSystem && (
                                <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] shadow-sm border border-white/10 overflow-hidden">
                                        {msg.avatar || '👤'}
                                    </div>
                                    <span className="text-[9px] text-white/40 drop-shadow-md font-bold">{msg.sender}</span>
                                </div>
                            )}
                            <div className={`
                                px-2.5 py-1 rounded-lg text-xs break-words max-w-full backdrop-blur-sm
                                ${msg.isSystem
                                    ? 'bg-red-500/30 text-red-100 border border-red-500/20 w-full text-center py-0.5 text-[10px]'
                                    : 'bg-black/40 text-white/90 border border-white/5'}
                            `}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>

                {/* Input - Compact */}
                <form onSubmit={handleSend} className="p-2 bg-white/5 border-t border-white/5 flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Yaz..."
                        className="flex-1 bg-black/20 border border-white/5 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/20 transition-colors placeholder:text-white/10"
                    />
                </form>
            </div>
        </div>
    );
};
