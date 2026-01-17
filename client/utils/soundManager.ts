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
        // Soft, pleasant, and non-annoying sound effects
        const soundUrls: Record<string, string> = {
            // UI Interactions - Very soft and subtle
            click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // Gentle click
            hover: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3", // Soft hover (not used)

            // Game Actions - Natural, soft tile sounds
            draw: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3", // Soft card slide (not used)
            discard: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // Gentle discard
            flip: "https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3", // Quick flip
            shuffle: "https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3", // Soft shuffle
            grab: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // Gentle grab
            drop: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // Gentle drop

            // Game Events - Pleasant, non-intrusive notifications
            your_turn: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3", // Soft chime
            game_start: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Gentle start
            joker_reveal: "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3", // Magical reveal
            dealing: "https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3", // Soft dealing

            // Countdown - Very gentle countdown
            countdown_tick: "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3", // Soft tick
            countdown_start: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Gentle go

            // Results - Positive but not overwhelming
            victory: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Pleasant victory
            win: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Happy win
            lose: "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3", // Gentle lose

            // Feedback - Soft and friendly
            error: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3", // Soft error
            chat: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // Friendly message
            laugh: "https://assets.mixkit.co/active_storage/sfx/2810/2810-preview.mp3" // Laugh for joker discard
        };

        Object.entries(soundUrls).forEach(([name, url]) => {
            const audio = new Audio(url);
            audio.preload = "auto";
            this.sounds.set(name, audio);
        });
    }

    public play(soundName: string, volumeScale: number = 1) {
        if (!this.isEnabled) return;

        const sound = this.sounds.get(soundName);
        if (!sound) return;

        try {
            // Clone the audio to allow multiple simultaneous plays
            const audioClone = sound.cloneNode() as HTMLAudioElement;
            audioClone.volume = this.volume * volumeScale;
            audioClone.play().catch(err => {
                // Silently fail if autoplay is blocked
                console.debug(`Sound play failed for ${soundName}:`, err);
            });
        } catch (err) {
            console.debug(`Sound error for ${soundName}:`, err);
        }
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
