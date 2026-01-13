"use client";

class SoundManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private isEnabled: boolean = true;
    private volume: number = 0.25;

    constructor() {
        if (typeof window !== "undefined") {
            const savedEnabled = localStorage.getItem("okey_sound_enabled");
            const savedVolume = localStorage.getItem("okey_sound_volume");

            if (savedEnabled !== null) this.isEnabled = savedEnabled === "true";
            if (savedVolume !== null) this.volume = parseFloat(savedVolume);

            this.loadSounds();
        }
    }

    private loadSounds() {
        // High quality sound effects (using CDN for demonstration, in a real app these would be local assets)
        const soundUrls: Record<string, string> = {
            click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
            hover: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
            draw: "https://assets.mixkit.co/active_storage/sfx/2007/2007-preview.mp3",
            discard: "https://assets.mixkit.co/active_storage/sfx/2007/2007-preview.mp3",
            flip: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
            shuffle: "https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3",
            your_turn: "https://assets.mixkit.co/active_storage/sfx/2016/2016-preview.mp3",
            game_start: "https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3",
            victory: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
            chat: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
            joker_reveal: "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3",
            countdown_tick: "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3",
            countdown_start: "https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3",
            error: "https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3",
            win: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
            lose: "https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3",
            grab: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
            drop: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
            dealing: "https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3"
        };

        Object.entries(soundUrls).forEach(([name, url]) => {
            const audio = new Audio(url);
            audio.preload = "auto";
            this.sounds.set(name, audio);
        });
    }

    public play(soundName: string, volumeScale: number = 1) {
        // Sound system disabled permanently
        return;
    }

    public setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        localStorage.setItem("okey_sound_enabled", enabled.toString());
    }

    public setVolume(volume: number) {
        this.volume = volume;
        localStorage.setItem("okey_sound_volume", volume.toString());
    }

    public getEnabled() {
        return this.isEnabled;
    }

    public getVolume() {
        return this.volume;
    }
}

// Export a singleton instance
export const soundManager = typeof window !== "undefined" ? new SoundManager() : ({} as SoundManager);
