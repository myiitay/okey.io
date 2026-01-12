import { Tile } from './OkeyGame';

export class HandValidator {
    private static cache: Map<string, boolean> = new Map();

    static validateHand(hand: Tile[], okeyTile: Tile): boolean {
        this.cache.clear();

        const processedHand = hand.map(t => {
            let pColor = t.color;
            let pValue = t.value;
            let isJoker = false;

            if (t.color === okeyTile.color && t.value === okeyTile.value) {
                isJoker = true;
            }

            if (t.color === 'fake') {
                pColor = okeyTile.color;
                pValue = okeyTile.value;
            }

            return { id: t.id, color: pColor, value: pValue, isJoker, original: t };
        });

        return this.canFormPairs(processedHand) || this.canFormSets(processedHand);
    }

    // --- 101 MODE HELPERS ---

    static findBestSets(hand: Tile[], okeyTile: Tile): { sets: Tile[][], sum: number } {
        const processedHand = hand.map(t => {
            let pColor = t.color;
            let pValue = t.value;
            let isJoker = false;

            if (t.color === okeyTile.color && t.value === okeyTile.value) {
                isJoker = true;
            }

            if (t.color === 'fake') {
                pColor = okeyTile.color;
                pValue = okeyTile.value;
            }

            return { id: t.id, color: pColor, value: pValue, isJoker, original: t };
        });

        const bestResult = { sets: [] as any[][], sum: 0 };

        // Use a simpler approach for performance: Greedy search
        this.greedySearchSum(processedHand, [], 0, bestResult);

        return {
            sets: bestResult.sets.map(s => s.map(t => t.original)),
            sum: bestResult.sum
        };
    }

    private static greedySearchSum(tiles: any[], currentSets: any[][], currentSum: number, best: { sets: any[][], sum: number }) {
        if (currentSum > best.sum) {
            best.sum = currentSum;
            best.sets = [...currentSets];
        }

        if (tiles.length < 3) return;

        // Optimization: only try a few starting tiles
        for (let i = 0; i < Math.min(tiles.length, 5); i++) {
            const start = tiles[i];
            const rest = [...tiles.slice(0, i), ...tiles.slice(i + 1)];

            // Groups
            const groups = this.findPossibleGroups(start, rest);
            for (const group of groups) {
                const s = this.calculateSetSum(group);
                this.greedySearchSum(this.removeTiles(tiles, group), [...currentSets, group], currentSum + s, best);
            }

            // Runs
            const runs = this.findPossibleRuns(start, rest);
            for (const run of runs) {
                const s = this.calculateSetSum(run);
                this.greedySearchSum(this.removeTiles(tiles, run), [...currentSets, run], currentSum + s, best);
            }
        }
    }

    private static calculateSetSum(set: any[]): number {
        let sum = 0;
        const isRun = set.length >= 3 && set.every((t, i) => i === 0 || t.color === set[0].color);

        if (isRun) {
            set.forEach(t => {
                if (t.isJoker) {
                    sum += 10;
                } else {
                    sum += t.value;
                }
            });
        } else {
            const val = set.find(t => !t.isJoker)?.value || 0;
            sum = val * set.length;
        }
        return sum;
    }

    private static canFormPairs(hand: any[]): boolean {
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
            if (count % 2 !== 0) jokersNeeded += 1;
        }

        if (jokers.length >= jokersNeeded) {
            pairsFormed += jokersNeeded;
            pairsFormed += Math.floor((jokers.length - jokersNeeded) / 2);
            return pairsFormed >= 7;
        }
        return false;
    }

    private static canFormSets(hand: any[]): boolean {
        this.cache.clear();
        return this.solve(hand);
    }

    private static solve(tiles: any[]): boolean {
        if (tiles.length === 0) return true;

        const ids = tiles.map(t => t.id).sort((a, b) => a - b);
        const cacheKey = ids.join(',');
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

        const sorted = [...tiles].sort((a, b) => {
            if (a.isJoker) return 1;
            if (b.isJoker) return -1;
            if (a.value !== b.value) return a.value - b.value;
            return a.color.localeCompare(b.color);
        });

        const current = sorted[0];
        const rest = sorted.slice(1);

        for (const group of this.findPossibleGroups(current, rest)) {
            if (this.solve(this.removeTiles(sorted, group))) {
                this.cache.set(cacheKey, true);
                return true;
            }
        }

        for (const run of this.findPossibleRuns(current, rest)) {
            if (this.solve(this.removeTiles(sorted, run))) {
                this.cache.set(cacheKey, true);
                return true;
            }
        }

        this.cache.set(cacheKey, false);
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

    private static findPossibleGroups(start: any, pool: any[]): any[][] {
        if (start.isJoker) return [];
        const results: any[][] = [];
        const candidates = pool.filter(t => t.isJoker || (t.value === start.value && t.color !== start.color));

        const combine = (currentSet: any[], index: number) => {
            if (currentSet.length >= 3) results.push([...currentSet]);
            if (currentSet.length === 4) return;

            for (let i = index; i < candidates.length; i++) {
                const next = candidates[i];
                const realTiles = currentSet.filter(x => !x.isJoker);
                if (!next.isJoker && realTiles.some(x => x.color === next.color)) continue;
                combine([...currentSet, next], i + 1);
            }
        };

        combine([start], 0);
        return results;
    }

    private static findPossibleRuns(start: any, pool: any[]): any[][] {
        if (start.isJoker) return [];
        const results: any[][] = [];

        const tryExtend = (currentChain: any[], needValue: number, hasWrapped: boolean) => {
            if (currentChain.length >= 3) results.push([...currentChain]);
            if (currentChain.length >= 13) return;

            let targetValue = needValue;
            let nextWrapped = hasWrapped;
            if (targetValue > 13) {
                targetValue = 1;
                nextWrapped = true;
            }

            const candidates = pool.filter(t =>
                !currentChain.some(c => c.id === t.id) &&
                (t.isJoker || (t.color === start.color && t.value === targetValue))
            );

            for (const next of candidates) {
                if (nextWrapped && targetValue === 1) {
                    results.push([...currentChain, next]);
                    continue;
                }
                tryExtend([...currentChain, next], targetValue + 1, nextWrapped);
            }
        };

        tryExtend([start], start.value + 1, false);
        return results;
    }
}
