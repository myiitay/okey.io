import { TileData } from "../components/game/types";

// Mode 1: Arrange by Groups (Runs + Sets)
export const arrangeByGroups = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
    // Basic sorting first to make it easier
    const sorted = [...normalTiles].sort((a, b) => {
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.value - b.value;
    });

    const groups: TileData[][] = [];
    const used = new Set<string>(); // `${color}-${value}-${id}`

    // 1. Find Sets (Same value, different colors)
    for (let i = 0; i < sorted.length; i++) {
        const t1 = sorted[i];
        if (used.has(`${t1.color}-${t1.value}-${t1.id}`)) continue;

        const currentSet = [t1];
        // Look for other colors with same value
        for (let j = i + 1; j < sorted.length; j++) {
            const t2 = sorted[j];
            if (used.has(`${t2.color}-${t2.value}-${t2.id}`)) continue;

            if (t2.value === t1.value && t2.color !== t1.color) {
                // Check if color already in set
                if (!currentSet.some(t => t.color === t2.color)) {
                    currentSet.push(t2);
                }
            }
        }

        if (currentSet.length >= 3) {
            currentSet.forEach(t => used.add(`${t.color}-${t.value}-${t.id}`));
            groups.push(currentSet);
        }
    }

    // 2. Find Runs (Same color, consecutive values)
    // We re-sort remaining unused tiles
    const remaining = sorted.filter(t => !used.has(`${t.color}-${t.value}-${t.id}`));
    // Sort by color then value
    remaining.sort((a, b) => {
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.value - b.value;
    });

    let currentRun: TileData[] = [];
    for (let i = 0; i < remaining.length; i++) {
        const t = remaining[i];
        if (currentRun.length === 0) {
            currentRun.push(t);
        } else {
            const last = currentRun[currentRun.length - 1];
            if (last.color === t.color && last.value === t.value - 1) {
                currentRun.push(t);
            } else if (last.color === t.color && last.value === t.value) {
                // Duplicate, skip or start new run? 
                // Skip for now in this logic or push to next run
            } else {
                if (currentRun.length >= 3) {
                    groups.push([...currentRun]);
                    currentRun.forEach(x => used.add(`${x.color}-${x.value}-${x.id}`)); // logic is kinda mixed as we are iterating remaining
                }
                currentRun = [t];
            }
        }
    }
    if (currentRun.length >= 3) {
        groups.push([...currentRun]);
    }

    // Flatten groups
    const newHand: (TileData | null)[] = [];
    groups.forEach(g => {
        newHand.push(...g);
        newHand.push(null); // Separator
    });

    // Add remaining tiles
    const leftovers = normalTiles.filter(t => !used.has(`${t.color}-${t.value}-${t.id}`) && !groups.some(g => g.includes(t)) && !newHand.includes(t)); // Filter safety

    // Add Okey tiles and Fake Jokers to the end for user to place
    const specials = [...okeyTiles, ...fakeJokers];

    // Combine: Groups + Spaced + Leftovers + Specials
    // Re-build hand with nulls
    const finalHand: (TileData | null)[] = [...newHand, ...leftovers, ...specials];

    // Pad with nulls up to previous length or 30 ? GameBoard uses dynamic
    // Just return generic flattened list, GameBoard will fit it into slots
    return finalHand;
};

// Mode 2: Arrange by Color
export const arrangeByColor = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
    const sorted = [...normalTiles].sort((a, b) => {
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.value - b.value;
    });

    // Group by color with spacers
    const newHand: (TileData | null)[] = [];
    let lastColor = "";
    sorted.forEach(t => {
        if (lastColor && t.color !== lastColor) {
            newHand.push(null);
        }
        newHand.push(t);
        lastColor = t.color;
    });

    return [...newHand, null, ...okeyTiles, ...fakeJokers];
};

// Mode 3: Arrange by Value
export const arrangeByValue = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
    const sorted = [...normalTiles].sort((a, b) => {
        if (a.value !== b.value) return a.value - b.value;
        return a.color.localeCompare(b.color);
    });

    const newHand: (TileData | null)[] = [];
    let lastVal = -1;
    sorted.forEach(t => {
        if (lastVal !== -1 && t.value !== lastVal) {
            newHand.push(null);
        }
        newHand.push(t);
        lastVal = t.value;
    });

    return [...newHand, null, ...okeyTiles, ...fakeJokers];
};

// Mode 4: Arrange by Potential (Near-complete groups)
export const arrangeByPotential = (normalTiles: TileData[], okeyTiles: TileData[], fakeJokers: TileData[]): (TileData | null)[] => {
    // This defines pairs (2 same val different color, or 2 consecutive same color)
    // Complex heuristic...
    // For now simple implementation similar to Groups but looser

    // Just alias to Groups for MVP refactor, or reuse the same logic
    return arrangeByGroups(normalTiles, okeyTiles, fakeJokers);
};

export const getColorName = (color: string) => {
    switch (color) {
        case 'red': return 'Kırmızı';
        case 'black': return 'Siyah';
        case 'blue': return 'Mavi';
        case 'yellow': return 'Sarı';
        default: return '';
    }
};

export const getRelativePlayer = (myIndex: number, targetIndex: number, totalPlayers: number, positions: string[]) => {
    // positions = ['bottom', 'right', 'top', 'left'] standard order

    if (myIndex === -1) return positions[targetIndex]; // Spectator sees absolute

    // difference: 0=me, 1=right, 2=top, 3=left
    // (target - me + 4) % 4
    const diff = (targetIndex - myIndex + 4) % 4;
    return positions[diff];
};
