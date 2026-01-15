import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TileData } from './types';
import { soundManager } from '../../utils/soundManager';


// Since we are extracting, we need to redefine or import TileData. 
// For now, I'll assume TileData is available or I'll define a local interface.
// Actually, let's keep it self contained or use the global type if exported.
// I will rewrite this to use the Tile component which seems to be internal in GameBoard or I need to import it.
// Looking at GameBoard, Tile is a component. I should extract Tile first or co-locate it.
// Let's create `Tile.tsx` and `DraggableTile.tsx`.

interface TileProps {
    color?: string;
    value?: number;
    size?: "sm" | "md" | "lg";
    isBack?: boolean;
    className?: string;
    onClick?: (e?: React.MouseEvent) => void;
}

// Reusable Tile Component (Premium 3D Design)
export const Tile = ({ color = 'black', value = 0, size = "md", isBack = false, className = "", onClick }: TileProps) => {
    // Defines the "ink" color for the number and shape
    const getInkColor = (c: string) => {
        switch (c) {
            case 'red': return 'text-red-600';
            case 'black': return 'text-gray-900';
            case 'blue': return 'text-blue-600';
            case 'yellow': return 'text-yellow-500'; // Darker yellow for readability on cream
            case 'fake': return 'text-purple-600'; // Purple for False Okey
            default: return 'text-gray-800';
        }
    };

    const renderShape = (col: string, isLarge = false) => {
        // Increased size for standard symbols as requested
        const sizeClass = isLarge ? "text-5xl drop-shadow-md" : "text-3xl";

        // Special handling for False Okey
        if (col === 'fake' || value === 0) {
            return <span className={`${sizeClass} text-purple-600 leading-none`}>★</span>;
        }

        const ink = getInkColor(col);

        /* 
           Using standard Unicode suits for simplicity and classic feel.
           Could use SVGs for even more precision, but these standard fonts usually render nicely.
        */
        if (col === 'red') return <span className={`${sizeClass} ${ink} leading-none`}>♥</span>;
        if (col === 'black') return <span className={`${sizeClass} ${ink} leading-none`}>♠</span>;
        if (col === 'blue') return <span className={`${sizeClass} ${ink} leading-none`}>♦</span>;
        if (col === 'yellow') return <span className={`${sizeClass} ${ink} leading-none`}>♣</span>;

        // Fallback
        return <span className={`${sizeClass} text-gray-400 leading-none`}>★</span>;
    }

    const sizeClasses = {
        sm: "w-8 h-12 text-lg",
        md: "w-11 h-16 md:w-14 md:h-20 text-3xl", // Slightly larger standard size
        lg: "w-16 h-24 md:w-20 md:h-28 text-5xl"
    };

    // Base Tile Style: mimicking an ivory/plastic Okey tile
    const tileBaseStyle = `
        relative select-none
        rounded-[6px] 
        bg-amber-50
        bg-gradient-to-b from-[#fffbf0] to-[#f4e4bc]
        shadow-[0_2px_0_#bcaaa4,0_3px_5px_rgba(0,0,0,0.2)]
        active:translate-y-[1px] active:shadow-[0_1px_0_#bcaaa4,0_2px_3px_rgba(0,0,0,0.2)]
        flex flex-col items-center justify-center
        transition-all duration-200
        border-[0.5px] border-amber-100/50
    `;

    if (isBack) {
        return (
            <div
                onClick={onClick}
                className={`
                ${tileBaseStyle}
                ${sizeClasses[size as keyof typeof sizeClasses]} 
                ${className}
            `}
            >
                {/* Back Design: A simple engraved rectangle or distinct pattern */}
                <div className="w-[85%] h-[90%] rounded-[4px] border-2 border-[#8d6e63]/30 bg-[#8d6e63]/5 flex items-center justify-center">
                    <div className="w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900 via-transparent to-transparent"></div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`
            ${tileBaseStyle}
            ${sizeClasses[size as keyof typeof sizeClasses]} 
            ${className}
        `}
        >
            {/* Inner slightly recessed area for 'engraved' look */}
            <div className="flex flex-col items-center justify-center w-full h-full pt-1">
                {value !== 0 ? (
                    <>
                        {/* Top Part: Number */}
                        <div className="flex-1 flex items-center justify-center">
                            <span
                                className={`font-black tracking-tight ${getInkColor(color)}`}
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    textShadow: '0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.05)'
                                }}
                            >
                                {value}
                            </span>
                        </div>

                        {/* Bottom Part: Symbol */}
                        <div className="flex-1 flex items-start justify-center transform scale-110 pb-2">
                            {renderShape(color)}
                        </div>
                    </>
                ) : (
                    /* False Okey: Large Symbol Centered Completely */
                    <div className="flex items-center justify-center w-full h-full">
                        {renderShape(color, true)}
                    </div>
                )}
            </div>

            {/* Subtle Shine/Highlight on top edge */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/60"></div>
        </div>
    );
};


interface DraggableTileProps {
    tile: TileData;
    isMyTurn: boolean;
    onDiscard: (id: number) => void;
    isOkey?: boolean;
    onFlip?: (id: number) => void;
    isFlipped?: boolean; // Current flip animation state (toggle)
    hasBeenFlipped?: boolean; // Has been flipped at least once (for glow removal)
}

export const DraggableTile = React.memo(({ tile, isMyTurn, onDiscard, isOkey = false, onFlip, isFlipped = false, hasBeenFlipped = false }: DraggableTileProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: tile.id, // Fixed: match raw ID for GameBoard logic
        data: tile
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.1 : 1})`,
        zIndex: isDragging ? 999 : 'auto',
        boxShadow: isDragging ? '0 20px 50px rgba(0,0,0,0.5)' : 'none',
    } : undefined;

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isOkey && onFlip) {
            e.preventDefault();
            onFlip(tile.id);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onContextMenu={handleContextMenu}
            className="relative group cursor-grab active:cursor-grabbing touch-none"
        >
            {/* Flip Container */}
            <div className={`relative transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                {/* Front */}
                {/* Front */}
                <div className="backface-hidden">
                    <Tile
                        color={tile.color}
                        value={tile.value}
                        onClick={isMyTurn ? () => onDiscard(tile.id) : undefined}
                        className={`
                            shadow-md 
                            ${isDragging ? 'ring-4 ring-yellow-400 rotate-3' : 'hover:-translate-y-1'}
                            ${isOkey && !hasBeenFlipped ? 'ring-4 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)]' : ''}
                        `}
                    />
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                    <Tile isBack size="md" className="shadow-md" />
                </div>
            </div>
        </div>
    );
});
DraggableTile.displayName = 'DraggableTile';
