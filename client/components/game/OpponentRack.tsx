import React from 'react';

interface OpponentRackProps {
    player: {
        id: string;
        isTurn: boolean;
    };
    isDisconnected?: boolean;
    position: 'right' | 'top' | 'left';
}

export const OpponentRack = React.memo(({ player, isDisconnected = false, position }: OpponentRackProps) => {
    if (!player) return null;
    const isTurn = player.isTurn;

    return (
        <div
            className={`
                relative bg-[#5d4037] border-2 border-[#3e2723] rounded-lg shadow-2xl flex items-center justify-center
                ${position === 'top' ? 'w-96 h-24' : 'w-24 h-96'} 
                transition-all duration-300 ease-in-out
                ${isDisconnected ? 'translate-y-[500px] rotate-12 opacity-0' : ''} 
                ${isTurn && !isDisconnected ? 'ring-4 ring-yellow-400 shadow-[0_0_50px_rgba(255,215,0,0.6)] z-30 scale-105' : ''}
            `}
            style={{
                transformOrigin: 'bottom center',
                transform: isDisconnected ? 'rotateX(90deg) translateY(200px) rotateZ(20deg)' : 'none'
            }}
        >
            {/* Wood Texture Detail */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>

            {/* 2 Levels Indication (Back side) */}
            {position === 'top' ? (
                <div className="w-[95%] h-[2px] bg-[#3e2723]/50 absolute top-1/2 left-1/2 -translate-x-1/2"></div>
            ) : (
                <div className="h-[95%] w-[2px] bg-[#3e2723]/50 absolute top-1/2 left-1/2 -translate-y-1/2"></div>
            )}

            {/* SCATTERING TILES EFFECT (Only when disconnected) */}
            {isDisconnected && Array.from({ length: 14 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute w-8 h-10 bg-[#fdfcdc] rounded shadow border border-gray-400"
                    style={{
                        top: '50%',
                        left: '50%',
                        animation: `scatter-${i % 4} 1.5s forwards ease-out`,
                        animationDelay: `${Math.random() * 0.2}s`
                    }}
                />
            ))}
        </div>
    );
});
