"use client";

import React, { useState, useEffect } from 'react';
import { soundManager } from '@/utils/soundManager';

export const SoundToggle: React.FC = () => {
    const [isEnabled, setIsEnabled] = useState(true);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsEnabled(soundManager.getEnabled());
    }, []);

    const toggleSound = () => {
        const next = !isEnabled;
        soundManager.setEnabled(next);
        setIsEnabled(next);
        if (next) soundManager.play('click');
    };

    return (
        <button
            onClick={toggleSound}
            className="flex items-center justify-center bg-black/40 backdrop-blur-xl w-10 h-10 rounded-xl border border-white/10 shadow-2xl transition-all duration-300 hover:bg-black/60 hover:scale-110 active:scale-90 text-xl"
            title={isEnabled ? "Sesi Kapat" : "Sesi Aç"}
        >
            {isEnabled ? '🔊' : '🔇'}
        </button>
    );
};
