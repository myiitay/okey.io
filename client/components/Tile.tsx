import React from 'react';

interface TileProps {
    color?: 'red' | 'black' | 'blue' | 'yellow' | 'fake';
    value?: number;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
    className?: string;
    isBack?: boolean; // New prop for showing the back of the tile
    style?: React.CSSProperties;
}

const colors = {
    red: 'text-[#e74c3c]',
    black: 'text-[#2c3e50]',
    blue: 'text-[#3498db]',
    yellow: 'text-[#f1c40f]',
    fake: 'text-[#27ae60]'
};

export const Tile: React.FC<TileProps> = ({ color, value, size = 'md', onClick, className = '', isBack = false, style }) => {
    // Dimension classes
    const dims = {
        sm: 'w-6 h-10 text-base',
        md: 'w-10 h-14 text-xl',
        lg: 'w-14 h-20 text-4xl'
    };

    if (isBack) {
        return (
            <div
                onClick={onClick}
                style={style}
                className={`
                    ${dims[size]}
                    bg-[#fdfcdc]
                    rounded-[4px]
                    shadow-[0_2px_0_#bcaaa4,0_2px_4px_rgba(0,0,0,0.2)]
                    flex flex-col items-center justify-center 
                    select-none
                    border border-[#d7ccc8]
                    ${className}
                `}
            >
                {/* Back Pattern - Simplified */}
                <div className="w-full h-full bg-[#f4e4bc] rounded-[2px] opacity-50 flex items-center justify-center">
                    <div className="w-2/3 h-2/3 border-2 border-[#8d6e63] opacity-20 rounded-sm"></div>
                </div>
            </div>
        );
    }

    const suitMap = {
        red: '♥',
        black: '♠',
        blue: '♦',
        yellow: '♣',
        fake: '★'
    };

    if (!color || value === undefined) return null;

    return (
        <div
            onClick={onClick}
            style={style}
            className={`
                ${dims[size]}
                relative
                bg-[#fdfcdc] /* Light cream surface */
                rounded-[8px]
                shadow-[0_4px_0_#cbb09c,0_6px_10px_rgba(0,0,0,0.15)] /* 3D effect + shadow */
                flex flex-col items-center justify-center 
                select-none cursor-pointer 
                transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#cbb09c,0_3px_5px_rgba(0,0,0,0.3)]
                ${className}
            `}
        >
            <span className={`font-black tracking-tighter ${colors[color]} drop-shadow-sm leading-none -mt-1`}>
                {color === 'fake' ? '★' : value}
            </span>
            {color !== 'fake' && (
                <div className={`text-[0.6em] mt-0.5 opacity-90 ${colors[color]}`}>
                    {suitMap[color]}
                </div>
            )}
        </div>
    );
};
