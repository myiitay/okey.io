import { Tile, Color } from '@okey/shared';

export class HandValidator {
    static validateHand(hand: Tile[], okeyTile: Tile): { isValid: boolean, usedJoker: boolean } {
        // Basic Logic:
        // 1. Identify Jokers (Tiles matching okeyTile attributes)
        // 2. Identify Fake Okeys (value 0) -> They act as the "Natural" value of okeyTile.
        //    (Wait, standard: Fake Okey is just a specific tile that takes place of the Joker's natural value)
        //    Example: Indicator Red 5. Okey is Red 6. 
        //    Players hold "Red 6" tiles as Jokers.
        //    Players hold "Fake Okey" (Black Picture) which counts as "Red 6".

        // This is a simplified variation of the "Backtracking" or "Knapsack" problem.
        // Since play hand is small (14 tiles), we can try to find Disjoint Sets.

        // Step 1: Normalize Hand
        // Convert tiles to a simpler representation: { color, value, isJoker, id }
        // Handle Fake Okey: It becomes the "natural" identity of the Okey tile.

        const naturalOkeyColor = okeyTile.color;
        const naturalOkeyValue = okeyTile.value;

        let hasJoker = false;

        const processedHand = hand.map(t => {
            let pColor = t.color;
            let pValue = t.value;
            let isJoker = false;

            // Is it a Joker (The actual Okey tile)?
            if (t.color === naturalOkeyColor && t.value === naturalOkeyValue) {
                isJoker = true;
                hasJoker = true;
            }

            // Is it a Fake Okey?
            if (t.color === 'fake') {
                // Takes the value of the Natural Okey
                pColor = naturalOkeyColor;
                pValue = naturalOkeyValue;
            }

            return {
                id: t.id,
                color: pColor,
                value: pValue,
                isJoker: isJoker,
                original: t
            };
        });

        // We need to partition 14 tiles into sets of 3 or 4.
        // Options:
        // A) 4 + 4 + 3 + 3 = 14
        // B) 4 + 3 + 3 + 4...
        // Essentially, all tiles must belong to a valid set.
        // Or 7 Pairs.

        // Strategy: Recursively try to extract valid sets.
        // Optimization: Sort by color/value.

        const canPair = this.canFormPairs(processedHand);
        const canSet = this.canFormSets(processedHand);

        const isValid = canSet || canPair;

        return { isValid, usedJoker: hasJoker };
    }

    private static canFormPairs(hand: any[]): boolean {
        // Logic: 7 pairs.
        // A pair is two identical tiles (Color + Value).
        // Jokers can complete any pair.
        // We need to match items.
        // Simple greedy approach often works for pairs but with jokers present, 
        // it's safest to prioritize matching non-jokers first.

        // Count frequencies of "Real" identities.
        // Jokers are wildcards.

        // This is simpler:
        // Remove pairs of identical non-joker tiles.
        // Remaining tiles must be matched with Jokers.
        // If (Remaining Non-Jokers) <= (Jokers), success.

        // BUT: What if we have 3 Red-7s?
        // Pair 1: Red-7 + Red-7.
        // Left: Red-7. Needs Joker.

        // Refined Logic:
        // Group by identity string "${color}-${value}".
        // Count size of each group.
        // Pairs = floor(count / 2).
        // Remainder = count % 2.
        // Total pairs needed = 7.
        // Natural pairs = sum(floor(count/2)).
        // Needed = 7 - Natural pairs.
        // Cost = Remainder * 1 (each remainder needs 1 joker to form a pair).
        // Check if we have enough jokers.
        // Also: Each Joker itself can form a pair with another Joker?
        // Actually, usually pair game requires Strict Pairs.
        // Joker + Red-7 = Valid Pair.
        // Joker + Joker = Valid Pair.

        const jokers = hand.filter(t => t.isJoker);
        const nonJokers = hand.filter(t => !t.isJoker);

        const counts = new Map<string, number>();
        for (const t of nonJokers) {
            const key = `${t.color}-${t.value}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        let pairsFormed = 0;
        let jokersNeeded = 0;

        for (const count of counts.values()) {
            pairsFormed += Math.floor(count / 2);
            if (count % 2 !== 0) {
                jokersNeeded += 1;
            }
        }

        // We have `jokers.length` available.
        // Use jokers to satisfy `jokersNeeded`.
        // Each used joker forms 1 pair with a single remainder.

        if (jokers.length >= jokersNeeded) {
            pairsFormed += jokersNeeded;
            const remainingJokers = jokers.length - jokersNeeded;
            // Remaining jokers pair with themselves
            pairsFormed += Math.floor(remainingJokers / 2);

            return pairsFormed >= 7;
        }

        return false;
    }

    private static canFormSets(hand: any[]): boolean {
        // Recursive backtracking to consume tiles into valid sets.
        // Sets:
        // 1. Group: Same Value, Different Colors. (Min 3)
        // 2. Series: Same Color, Consecutive Values. (Min 3). 1 can follow 13.

        if (hand.length === 0) return true;

        // Sort to make finding series easier?
        // Actually, just pick the first tile and try to form a set with it.

        const first = hand[0];

        // Try all combinations involving 'first'
        // This is computationally expensive (O(N!)) but N=14 is small enough for modern JS if pruned well.
        // Optimization: Limit set size to 4 (since >4 can be split, except for long series... 
        // actually 123456 is just two sets of 3, 123 456? No, 5 tiles is not 2 sets. 
        // But 14 tiles usually partition into 4-4-3-3 or similar.
        // Max set size we *need* to check is probably 14 (a single run), but practically small groups.

        // Let's implement a standard "Try to form a set of size 3, then recurse" or "Size 4...".
        // Also need to handle Jokers.

        // For 'first' tile:
        // A) Use in Group (Same Value)
        // B) Use in Series (Run)

        // Try forming Group of 3
        // Try forming Group of 4
        // Try forming Run of minimum 3... up to length

        // NOTE: This implementation is non-trivial to get bug-free in one shot.
        // Simplified approach for MVP:
        // Use a library? No.
        // Use simple heuristics? No user said "Hatasız olmalı".
        // I will write a concise backtracker.

        return this.solve(hand);
    }

    private static solve(tiles: any[]): boolean {
        if (tiles.length === 0) return true;

        tiles.sort((a, b) => {
            if (a.isJoker && !b.isJoker) return 1;
            if (!a.isJoker && b.isJoker) return -1;
            if (a.isJoker && b.isJoker) return 0;
            if (a.value !== b.value) return a.value - b.value;
            return a.color.localeCompare(b.color);
        });

        const current = tiles[0];
        const rest = tiles.slice(1); // Potentially

        // 1. Try Group (Same Value)
        // Need at least 2 more tiles with same value (diff color) or Jokers.
        const possibleGroups = this.findPossibleGroups(current, rest);
        for (const group of possibleGroups) {
            const remaining = this.removeTiles(tiles, group);
            if (this.solve(remaining)) return true;
        }

        // 2. Try Run (Consecutive)
        const possibleRuns = this.findPossibleRuns(current, rest);
        for (const run of possibleRuns) {
            const remaining = this.removeTiles(tiles, run);
            if (this.solve(remaining)) return true;
        }

        // 3. Try Wrapping Run ending in 1 (e.g., 11-12-13-1)
        if (current.value === 1 && !current.isJoker) {
            const wrapRuns = this.findWrappingRunsEndingInOne(current, rest);
            for (const run of wrapRuns) {
                const remaining = this.removeTiles(tiles, run);
                if (this.solve(remaining)) return true;
            }
        }

        return false;
    }

    private static removeTiles(source: any[], toRemove: any[]): any[] {
        const remaining = [...source];
        for (const item of toRemove) {
            const idx = remaining.findIndex(x => x.id === item.id);
            if (idx !== -1) remaining.splice(idx, 1);
        }
        return remaining;
    }

    // ... Helper finders
    private static findPossibleGroups(start: any, pool: any[]): any[][] {
        // Group: Same Value, Different Colors.
        // Start is 1. We need 2 or 3 more. 
        // Max group size is 4 (4 colors).
        // We must select distinct colors.

        if (start.isJoker) return []; // Should have sorted jokers to end, so start is rarely joker unless all jokers.
        // If start is joker, it can be anything, but we usually pivot on non-joker.

        const results: any[][] = [];

        // Find candidates: Same value, diff color OR Joker
        const candidates = pool.filter(t => t.isJoker || (t.value === start.value && t.color !== start.color));

        // We need combinations of size 2 and 3 from candidates.
        // And we must enforce distinct colors (unless joker).

        const combine = (currentSet: any[], index: number) => {
            if (currentSet.length >= 3) {
                // Valid set
                results.push([...currentSet]);
            }
            if (currentSet.length === 4) return;

            for (let i = index; i < candidates.length; i++) {
                const next = candidates[i];
                // Check color conflict
                // If next is joker, no conflict.
                // If next is real, check if color already exists in REAL tiles of set
                const realTiles = currentSet.filter(x => !x.isJoker);
                if (!next.isJoker && realTiles.some(x => x.color === next.color)) continue;

                // Add
                combine([...currentSet, next], i + 1);
            }
        };

        combine([start], 0);
        return results;
    }

    private static findPossibleRuns(start: any, pool: any[]): any[][] {
        if (start.isJoker) return [];
        const results: any[][] = [];

        const tryExtend = (currentChain: any[], nextValue: number, hasWrapped: boolean) => {
            if (currentChain.length >= 3) {
                results.push([...currentChain]);
            }

            // In standard Okey, a wrap-around run ending in 1 is terminal. (e.g., 12-13-1)
            // It cannot be continued with 2.
            if (hasWrapped && currentChain[currentChain.length - 1].value === 1) {
                return;
            }

            let effectiveNextValue = nextValue;
            let willWrap = hasWrapped;

            if (effectiveNextValue > 13) {
                if (willWrap) return; // Cannot wrap twice
                effectiveNextValue = 1;
                willWrap = true;
            }

            const candidates = pool.filter(t =>
                !currentChain.some(c => c.id === t.id) &&
                (t.isJoker || (t.color === start.color && t.value === effectiveNextValue))
            );

            for (const next of candidates) {
                tryExtend([...currentChain, next], effectiveNextValue + 1, willWrap);
            }
        };

        tryExtend([start], start.value + 1, false);
        return results;
    }

    private static findWrappingRunsEndingInOne(oneTile: any, pool: any[]): any[][] {
        const results: any[][] = [];

        // We are at '1'. We want to find chains like [..., 11, 12, 13, 1]
        // Search backwards: 1 -> 13 -> 12 -> 11 ...
        const tryExtendBackwards = (currentChain: any[], nextNeededValue: number) => {
            if (currentChain.length >= 3) {
                results.push([...currentChain]);
            }

            // Standard Okey runs don't typically go below length 3,
            // but we can have 11-12-13-1 (len 4), 10-11-12-13-1 (len 5) etc.
            if (nextNeededValue < 1) return;

            const candidates = pool.filter(t =>
                !currentChain.some(c => c.id === t.id) &&
                (t.isJoker || (t.color === oneTile.color && t.value === nextNeededValue))
            );

            for (const prev of candidates) {
                tryExtendBackwards([...currentChain, prev], nextNeededValue - 1);
            }
        };

        tryExtendBackwards([oneTile], 13);
        return results;
    }
}
