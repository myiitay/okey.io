"use client";

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tile } from '../Tile';
import { TileData } from './types';

interface DraggableTileProps {
    tile: TileData;
    isMyTurn: boolean;
    onDiscard: (id: number) => void;
    isOkey: boolean;
    onFlip: (id: number) => void;
    isFlipped: boolean;
}

export const DraggableTile: React.FC<DraggableTileProps> = ({
    tile,
    isMyTurn,
    onDiscard,
    isOkey,
    onFlip,
    isFlipped
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: tile.id.toString()
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isOkey || tile.color === 'fake') {
            e.preventDefault();
            onFlip(tile.id);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onContextMenu={handleContextMenu}
            className="relative group touch-none h-full w-full flex items-center justify-center p-1"
        >
            <Tile
                {...tile}
                size="lg"
                isBack={isFlipped}
                onClick={isMyTurn ? () => onDiscard(tile.id) : undefined}
                className={`
                    shadow-xl transition-transform h-full w-full
                    ${isMyTurn ? "cursor-pointer hover:ring-2 hover:ring-red-500" : ""}
                    ${isFlipped ? "rotate-y-180" : ""}
                `}
            />
        </div>
    );
};
