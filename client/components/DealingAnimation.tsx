import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from './game/types';
import { soundManager } from '../utils/soundManager';

interface DealingAnimationProps {
    gameState: GameState;
    onComplete: () => void;
}

export const DealingAnimation: React.FC<DealingAnimationProps> = ({ gameState, onComplete }) => {
    const [count, setCount] = useState<number | null>(3);

    useEffect(() => {
        let mounted = true;

        const runCountdown = async () => {
            // 3
            soundManager.play('countdown_tick');
            await new Promise(r => setTimeout(r, 1000));

            // 2
            if (!mounted) return;
            setCount(2);
            soundManager.play('countdown_tick');
            await new Promise(r => setTimeout(r, 1000));

            // 1
            if (!mounted) return;
            setCount(1);
            soundManager.play('countdown_tick');
            await new Promise(r => setTimeout(r, 1000));

            // GO!
            if (!mounted) return;
            setCount(0);
            soundManager.play('countdown_start');
            await new Promise(r => setTimeout(r, 800));

            // Complete
            if (mounted) onComplete();
        };

        runCountdown();

        return () => { mounted = false; };
    }, [onComplete]);

    if (count === null) return null;

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360]
                    }}
                    transition={{
                        duration: 3,
                        ease: "linear"
                    }}
                />
            </div>

            {/* Countdown */}
            <AnimatePresence mode="wait">
                {count > 0 ? (
                    <motion.div
                        key={count}
                        initial={{ scale: 0, opacity: 0, rotate: -180 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, rotate: 180 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 20
                        }}
                        className="relative"
                    >
                        {/* Glow effect */}
                        <motion.div
                            className="absolute inset-0 rounded-full blur-3xl"
                            style={{
                                background: count === 3 ? '#3b82f6' : count === 2 ? '#8b5cf6' : '#ec4899'
                            }}
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.5, 0.8, 0.5]
                            }}
                            transition={{
                                duration: 0.8,
                                repeat: Infinity
                            }}
                        />

                        {/* Number */}
                        <div className="relative text-[200px] font-black text-white drop-shadow-2xl">
                            {count}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="go"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                        exit={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="relative"
                    >
                        {/* GO! text */}
                        <div className="relative">
                            <motion.div
                                className="absolute inset-0 blur-2xl bg-green-500/60"
                                animate={{
                                    scale: [1, 1.5, 2],
                                    opacity: [0.6, 0.3, 0]
                                }}
                                transition={{ duration: 0.8 }}
                            />
                            <div className="relative text-[150px] font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 drop-shadow-2xl">
                                BAŞLA!
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Decorative particles */}
            <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white/30 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`
                        }}
                        animate={{
                            y: [0, -100, -200],
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.1,
                            ease: "easeOut"
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
