"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'tr' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const dictionary: Record<string, Record<Language, string>> = {
    // Home / Lobby
    "enter_nickname": { tr: "Lütfen bir takma ad giriniz!", en: "Please enter a nickname first!" },
    "enter_code": { tr: "Lütfen bir oda kodu giriniz!", en: "Please enter a room code!" },
    "choose_nickname": { tr: "Takma adını seç", en: "Choose your nickname" },
    "nickname_placeholder": { tr: "Takma Ad", en: "Nickname" },
    "create_room": { tr: "ODA OLUŞTUR", en: "CREATE ROOM" },
    "or": { tr: "VEYA", en: "OR" },
    "join_room": { tr: "ODAYA KATIL", en: "JOIN ROOM" },
    "online_status": { tr: "Çevrimiçi", en: "Online" },

    // Waiting Room
    "waiting_room": { tr: "BEKLEME ODASI", en: "WAITING ROOM" },
    "room_code": { tr: "Oda Kodu", en: "Room Code" },
    "copy": { tr: "KOPYALA", en: "COPY" },
    "copied": { tr: "KOPYALANDI", en: "COPIED" },
    "players": { tr: "OYUNCULAR", en: "PLAYERS" },
    "host": { tr: "KURUCU", en: "HOST" },
    "you": { tr: "SEN", en: "YOU" },
    "start_match": { tr: "OYUNU BAŞLAT 🚀", en: "START MATCH 🚀" },
    "waiting_host": { tr: "Kurucunun başlatması bekleniyor...", en: "Waiting for host to start..." },
    "waiting_players": { tr: "Oyuncu bekleniyor...", en: "Waiting for players..." },
    "min_player_warning": { tr: "Başlamak için en az 1 oyuncu (Test) gerekli...", en: "Waiting for at least 1 player to start..." },

    // Game Board
    "exit": { tr: "ÇIKIŞ", en: "EXIT" },
    "victory": { tr: "ZAFER!", en: "VICTORY!" },
    "game_over": { tr: "OYUN BİTTİ", en: "GAME OVER" },
    "play_again": { tr: "Tekrar Oynayın", en: "Play Again" },
    "winner_msg": { tr: "Tebrikler usta! Eli kazandın.", en: "Masterful play! You have won the round." },
    "loser_msg": { tr: "Kazanan:", en: "Winner:" },
    "your_turn": { tr: "SIRA SENDE", en: "YOUR TURN" },
    "take": { tr: "AL", en: "TAKE" },
    "drag_finish": { tr: "Bitirmek için sürükle?", en: "Drag here to finish?" },
    "dealing": { tr: "TAŞLAR DAĞITILIYOR...", en: "DEALING TILES..." },
    "connecting": { tr: "Bağlanıyor...", en: "Connecting..." },
    "leave_confirm": { tr: "Oyundan ayrılmak istediğine emin misin?", en: "Are you sure you want to leave the game?" },
    "lang_code": { tr: "tr", en: "en" },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('en');

    useEffect(() => {
        // Auto-detect based on navigator
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('tr')) {
            setLanguage('tr');
        } else {
            setLanguage('en');
        }

        // Check localStorage? (Optional, if we want persistence)
        const saved = localStorage.getItem('okey_lang') as Language;
        if (saved) setLanguage(saved);
    }, []);

    const updateLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('okey_lang', lang);
    };

    const t = (key: string): string => {
        const entry = dictionary[key];
        if (!entry) return key; // Fallback to key if missing
        return entry[language];
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: updateLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};
