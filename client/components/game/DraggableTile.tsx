import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TileData } from './types';
import { Tile } from '../Tile';

interface DraggableTileProps {
    tile: TileData;
    isMyTurn: boolean;
    onDiscard: (id: number) => void;
    isOkey?: boolean;
    onFlip?: (id: number) => void;
    isFlipped?: boolean;
    hasBeenFlipped?: boolean;
    design?: 'classic' | 'modern' | 'minimal';
}

export const DraggableTile = React.memo(({
    tile,
    isMyTurn,
    onDiscard,
    isOkey = false,
    onFlip,
    isFlipped = false,
    hasBeenFlipped = false,
    design = 'classic'
}: DraggableTileProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: tile.id,
        data: { ...tile, isFlipped }
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
                <div className="backface-hidden">
                    <Tile
                        color={tile.color}
                        value={tile.value}
                        design={design}
                        className={`
                            shadow-md 
                            ${isDragging ? 'ring-4 ring-yellow-400 rotate-3' : 'hover:-translate-y-1'}
                            ${isOkey && !hasBeenFlipped ? 'ring-4 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)]' : ''}
                        `}
                    />
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180">
                    <Tile isBack size="md" design={design} className="shadow-md" />
                </div>
            </div>
        </div>
    );
});
DraggableTile.displayName = 'DraggableTile';
