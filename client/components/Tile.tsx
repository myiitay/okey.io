import React from 'react';
import { Color } from '@okey/shared';

interface TileProps {
    color?: Color;
    value?: number;
    size?: 'sm' | 'md' | 'lg';
    onClick?: (e?: React.MouseEvent) => void;
    className?: string;
    isBack?: boolean;
    style?: React.CSSProperties;
    design?: 'classic' | 'modern' | 'minimal';
}

export const Tile: React.FC<TileProps> = ({
    color = 'black',
    value = 0,
    size = 'md',
    onClick,
    className = '',
    isBack = false,
    style,
    design = 'classic'
}) => {
    const getInkColor = (c: string) => {
        switch (c) {
            case 'red': return 'text-red-600';
            case 'black': return 'text-gray-900';
            case 'blue': return 'text-blue-600';
            case 'yellow': return 'text-yellow-500';
            case 'fake': return 'text-purple-600';
            default: return 'text-gray-800';
        }
    };

    const renderShape = (col: string, isLarge = false) => {
        const sizeClass = isLarge ? "text-5xl drop-shadow-md" : "text-3xl";
        if (col === 'fake' || value === 0) {
            return <span className={`${sizeClass} text-purple-600 leading-none`}>★</span>;
        }
        const ink = getInkColor(col);
        if (col === 'red') return <span className={`${sizeClass} ${ink} leading-none`}>♥</span>;
        if (col === 'black') return <span className={`${sizeClass} ${ink} leading-none`}>♠</span>;
        if (col === 'blue') return <span className={`${sizeClass} ${ink} leading-none`}>♦</span>;
        if (col === 'yellow') return <span className={`${sizeClass} ${ink} leading-none`}>♣</span>;
        return <span className={`${sizeClass} text-gray-400 leading-none`}>★</span>;
    }

    const sizeClasses = {
        sm: "w-8 h-12 text-lg",
        md: "w-11 h-16 md:w-14 md:h-20 text-3xl",
        lg: "w-16 h-24 md:w-20 md:h-28 text-5xl"
    };

    const designConfig = {
        classic: {
            round: 'rounded-[6px]',
            bg: 'bg-gradient-to-b from-[#fffbf0] to-[#f4e4bc]',
            shadow: 'shadow-[0_4px_0_#bcaaa4,0_6px_10px_rgba(0,0,0,0.2)]',
            border: 'border-[0.5px] border-amber-100/50',
            font: 'font-black tracking-tight',
            showSuit: true
        },
        modern: {
            round: 'rounded-[12px]',
            bg: 'bg-white',
            shadow: 'shadow-[0_10px_30px_rgba(0,0,0,0.1),inset_0_-2px_4px_rgba(0,0,0,0.05)]',
            border: 'border border-gray-200',
            font: 'font-extrabold tracking-normal',
            showSuit: true
        },
        minimal: {
            round: 'rounded-[2px]',
            bg: 'bg-[#fafafa]',
            shadow: 'shadow-[2px_2px_0_rgba(0,0,0,0.05)]',
            border: 'border border-black/10',
            font: 'font-medium tracking-widest',
            showSuit: false
        }
    }[design];

    const tileBaseStyle = `
        relative select-none
        ${designConfig.round} 
        ${designConfig.bg}
        ${designConfig.shadow}
        ${designConfig.border}
        active:translate-y-[1px]
        flex flex-col items-center justify-center
        transition-all duration-200
    `;

    if (isBack) {
        return (
            <div
                onClick={onClick}
                style={style}
                className={`
                ${tileBaseStyle}
                ${sizeClasses[size as keyof typeof sizeClasses]} 
                ${className}
            `}
            >
                <div className="w-[85%] h-[90%] rounded-[4px] border-2 border-[#8d6e63]/30 bg-[#8d6e63]/5 flex items-center justify-center">
                    <div className="w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900 via-transparent to-transparent"></div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            style={style}
            className={`
            ${tileBaseStyle}
            ${sizeClasses[size as keyof typeof sizeClasses]} 
            ${className}
        `}
        >
            <div className="flex flex-col items-center justify-center w-full h-full pt-1">
                {value !== 0 ? (
                    <>
                        <div className="flex-1 flex items-center justify-center">
                            <span
                                className={`${designConfig.font} ${getInkColor(color)}`}
                                style={{
                                    textShadow: design === 'classic' ? '0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                {value}
                            </span>
                        </div>
                        {designConfig.showSuit && (
                            <div className="flex-1 flex items-start justify-center transform scale-110 pb-2">
                                {renderShape(color)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full h-full -mt-2">
                        {renderShape(color, true)}
                    </div>
                )}
            </div>
            {design === 'classic' && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/60"></div>}
        </div>
    );
};
