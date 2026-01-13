import React from 'react';

interface PlayerAvatarProps {
    player: {
        id: string;
        isTurn: boolean;
    };
    info: {
        name: string;
        avatar: string;
    };
    isDisconnected?: boolean;
    position: 'right' | 'top' | 'left';
}

export const PlayerAvatar = React.memo(({ player, info, isDisconnected = false, position }: PlayerAvatarProps) => {
    if (!player) return null;

    return (
        <div className={`flex flex-col items-center z-20 relative transition-all duration-1000 ${isDisconnected ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}>
            {/* Disconnect Notification */}
            {isDisconnected && (
                <div className="absolute -top-12 z-50 bg-red-600/90 text-white px-4 py-2 rounded-full font-bold animate-[bounce_1s_infinite] whitespace-nowrap">
                    🚫 OYUNDAN ÇIKTI
                </div>
            )}

            <div className="w-16 h-16 rounded-full bg-black/40 border-2 border-white/10 flex items-center justify-center text-3xl shadow-lg backdrop-blur-sm relative">
                {info?.avatar || '👤'}
                {player.isTurn && !isDisconnected && <div className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-pulse"></div>}
            </div>
            <div className="bg-black/60 px-3 py-1 rounded-full text-white font-bold text-sm backdrop-blur-md mt-2 border border-white/5 shadow-md">
                {info?.name || '...'}
            </div>
        </div>
    );
});
