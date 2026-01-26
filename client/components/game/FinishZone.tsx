import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface FinishZoneProps {
    isMyTurn: boolean;
    gameMode?: 'standard';
}

export const FinishZone: React.FC<FinishZoneProps> = ({ isMyTurn, gameMode = 'standard' }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'finish-zone' });
    const is101Mode = false;

    if (!isMyTurn) return null;

    return (
        <div
            ref={setNodeRef}
            className={`
                absolute top-1/2 -translate-y-1/2 right-[-260px] w-24 h-32 rounded-3xl border-4 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2
                ${isOver
                    ? 'bg-yellow-500/20 border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.3)]'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }
                scale-110
            `}
        >
            <div className={`text-4xl transition-transform duration-300 ${isOver ? 'scale-125 rotate-12' : ''}`}>🏆</div>
            <div className="text-[10px] font-black text-white/50 text-center uppercase tracking-tighter leading-none">
                BİTİRMEK <br /> İÇİN BURAYA
            </div>
            {isOver && (
                <div className={`absolute inset-0 rounded-3xl animate-ping border-4 border-yellow-400/50`}></div>
            )}
        </div>
    );
};
