import { Tile, Color, PlayerState, GameState } from '@okey/shared';
import { GameState101, PlayerState101, OpenedSet } from '@okey/shared';
import { randomUUID } from 'crypto';

export class Game101 {
    private deck: Tile[] = [];
    private players: PlayerState101[] = [];
    private playerIds: string[];
    private indicator!: Tile;
    private okeyTile!: Tile; // The actual wild card (e.g. Red 6)
    private turnIndex: number = 0;
    private status: 'PLAYING' | 'FINISHED' = 'PLAYING';
    private onStateChange: (state: GameState101) => void;
    private turnTimer: number = 30;
    private timerInterval: NodeJS.Timeout | null = null;
    private openedSets: OpenedSet[] = [];

    constructor(playerIds: string[], onStateChange: (state: GameState101) => void) {
        this.playerIds = playerIds;
        this.onStateChange = onStateChange;
        this.status = 'PLAYING';
        this.initializeGame();
    }

    private initializeGame() {
        this.deck = this.createDeck();
        this.shuffleDeck();
        this.selectJoker(); // Determine indicator and wild tile first

        this.turnIndex = Math.floor(Math.random() * this.playerIds.length);

        this.players = this.playerIds.map((id, index) => {
            const count = index === this.turnIndex ? 15 : 14;
            const hand = this.drawTiles(count);
            // Sort hand initially for convenience? No, let client handle.
            return {
                id,
                hand,
                discards: [],
                isTurn: index === this.turnIndex,
                openned: false,
                score: 0
            };
        });
    }

    public start(): GameState101 {
        this.startTimer();
        return this.getGameState();
    }

    // --- Core Logic ---

    private getWildTile(): { color: Color, value: number } {
        return { color: this.okeyTile.color, value: this.okeyTile.value };
    }

    private isJoker(tile: Tile): boolean {
        // A tile is a Joker (Wild) if it matches the OkeyTile's value and color.
        // It acts as ANY tile.
        return tile.color === this.okeyTile.color && tile.value === this.okeyTile.value;
    }

    private isFakeJoker(tile: Tile): boolean {
        // The physical "Fake Joker" tile. It takes the place of the OkeyTile's original face value.
        return tile.color === 'fake';
    }

    private getEffectiveTile(tile: Tile): { color: Color, value: number, isWild: boolean } {
        // Returns the effective value for sorting/logic
        // If it's a Joker (Wild), it returns isWild=true.
        // If it's a Fake Joker, it returns the fixed face value of the OkeyTile (e.g. if Red 6 is wild, Fake is Red 6).

        if (this.isJoker(tile)) {
            return { color: tile.color, value: tile.value, isWild: true };
        }

        if (this.isFakeJoker(tile)) {
            return { color: this.okeyTile.color, value: this.okeyTile.value, isWild: false };
        }

        return { color: tile.color, value: tile.value, isWild: false };
    }

    // --- Validation Logic ---

    private calculateSeriesPoints(tiles: Tile[]): number | null {
        // Validates series and returns its point value. Returns null if invalid.
        if (tiles.length < 3) return null;

        const wildTiles: Tile[] = [];
        const realTiles: Tile[] = [];

        tiles.forEach(t => {
            if (this.isJoker(t)) wildTiles.push(t);
            else realTiles.push(t);
        });

        // Optimize: If all are wild, pick highest value? usually treated as 13-13-13 or similar.
        // But practically, at least 1 real tile is needed to define color, unless all are wild (very rare, user chooses behavior).
        // Let's assume at least 1 real tile for simplicity or infer from context. Logic for "All Wild" is edge case.
        if (realTiles.length === 0) return null; // Can't determine series without a real tile anchor

        // 1. Check Color Consistency
        // Real tiles must have matching color. (Fake joker takes OkeyTile's color, handled in getEffectiveTile?)
        // Wait, Fake Joker (the tile with star) REPLACES the tile that became Joker.
        // Example: Indicator Red 5. Okey (Wild) is Red 6. Fake Joker matches Red 6.
        // A series "Red 5 - Fake Joker - Red 7" is VALID. Color is Red.

        const firstEffective = this.getEffectiveTile(realTiles[0]);
        const targetColor = firstEffective.color;

        for (const t of realTiles) {
            const eff = this.getEffectiveTile(t);
            if (eff.color !== targetColor) return null; // Mixed colors
        }

        // 2. Sort and Check Sequence
        // We need to fit wildcards into gaps.
        // Values can be 1..13. 
        // Special 12-13-1 case.

        // This is a constraint satisfaction problem if we have multiple wilds and big gaps.
        // Simplified approach: sort real values. check gaps.

        const realValues = realTiles.map(t => this.getEffectiveTile(t).value).sort((a, b) => a - b);

        // Check for duplicates in real values (invalid in series)
        if (new Set(realValues).size !== realValues.length) return null;

        // Check 12-13-1 case specifically?
        // Normal Sequence Check
        let neededWilds = 0;
        let runningSum = 0; // Sum of real values

        for (let i = 0; i < realValues.length - 1; i++) {
            const current = realValues[i];
            const next = realValues[i + 1];

            // Gap calculation. E.g. 5 and 7. Gap is 1 (6).
            // 5 and 6. Gap is 0.
            let gap = next - current - 1;

            // Special case: 1 after 13?
            // If we have 1 and 13 in the set, sorting puts 1 at start, 13 at end.
            // But 1 can act as 14.
            // If the set contains 1 and we want to treat it as "after 13", we should treat 1 as 14?

            // Better approach:
            // Check if strictly consecutive with available wilds.
            neededWilds += gap;
            runningSum += current;
        }
        runningSum += realValues[realValues.length - 1];

        // Special 13-1 check
        let isWrapping = false;
        if (realValues[0] === 1 && realValues[realValues.length - 1] === 13) {
            // This MIGHT be a wrap. But wait, if we have [1, 13], gap is 11. neededWilds=11.
            // But if it's treated as 13-1, gap is 0.
            // How to detect?
            // If we have "enough" wilds for normal gap, prefer normal (1..13).
            // If not, try wrap.

            // Let's simple check: If [1, ... 13] sequence fails normal, try [..., 13, 14] check
            // Only valid if the 1 is visibly a 1 tile.
            // Actually, usually in Okey, 1 can come after 13.
        }

        if (neededWilds > wildTiles.length) {
            // Too many gaps.
            // TODO: Check wrapping logic (13-1) more robustly if standard fails.
            return null;
        }

        // 3. Calculate Points
        // Joker Value: In a series, Joker takes value of missing tile.
        // We need to reconstruct the full sequence `values`.

        // Re-construct logic:
        // Start from min real val. Fill gaps.
        // Remaining jokers go to ends.
        // This determines value.

        // Basic Sum:
        let totalPoints = 0;

        // Simple heuristic for points:
        // Sum of all real tiles + (number of wildcards * avg value?). 
        // No, rule: Joker takes value of replaced tile.

        // Let's assume the user put them in order? No, client sends list, order matters?
        // If client sends strictly ordered list defined by user slots, we can trust order!
        // Trusting client order simplifies "Joker Value" deduction.
        // Client sends: [Red 5, Joker, Red 7] -> Joker is 6.
        // Client sends: [Joker, Red 5, Red 6] -> Joker is 4.

        // YES. We assume `tiles` array is ORDERED by the user on the rack/board.
        // This is critical.

        let predictedValue = -1;
        let points = 0;

        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const eff = this.getEffectiveTile(tile);

            if (i === 0) {
                // First tile
                if (eff.isWild) {
                    // Need to look ahead to find anchor
                    let anchorIdx = -1;
                    let gaps = 0;
                    for (let j = 1; j < tiles.length; j++) {
                        const t = this.getEffectiveTile(tiles[j]);
                        if (!t.isWild) {
                            anchorIdx = j;
                            break;
                        }
                        gaps++;
                    }
                    if (anchorIdx === -1) return null; // All wild

                    const anchorVal = this.getEffectiveTile(tiles[anchorIdx]).value;
                    // Back calculate
                    // If anchor is 5 at index 2 (Wild, Wild, 5). 
                    // Index 1 is 4. Index 0 is 3.
                    let startVal = anchorVal - anchorIdx;
                    if (startVal < 1) return null; // Cannot go below 1 (except wrapping?)

                    predictedValue = startVal;
                } else {
                    predictedValue = eff.value;
                }
            }

            // Validate current tile against predicted
            let currentValue = 0;
            if (eff.isWild) {
                currentValue = predictedValue;
            } else {
                if (eff.value !== predictedValue) {
                    return null; // Sequence broken
                } else {
                    currentValue = eff.value;
                }
            }

            points += currentValue;

            // Prepare next predicted
            predictedValue = currentValue + 1;
            if (predictedValue > 13) predictedValue = -1; // End of sequence, cannot continue 
            // NOTE: 13 -> 1 is allowed. 1 -> 2 is allowed. Sequence 13, 1, 2 is valid.
        }

        return points;
    }

    private calculateGroupPoints(tiles: Tile[]): number | null {
        // Validates Group (Set) [7, 7, 7] and returns points.
        if (tiles.length < 3) return null;
        if (tiles.length > 4) return null; // Max 4 colors

        // Check values match
        const realTiles = tiles.filter(t => !this.getEffectiveTile(t).isWild);
        if (realTiles.length === 0) {
            // All wild? valid group? theoretically yes.
            // Value is... ? User logic.
            // But assume at least 1 real.
            return null;
        }

        const baseVal = this.getEffectiveTile(realTiles[0]).value;

        // Colors must be distinct AND values must match baseVal
        const colors = new Set<string>();

        for (const t of tiles) {
            const eff = this.getEffectiveTile(t);
            if (!eff.isWild) {
                if (eff.value !== baseVal) return null; // Value mismatch
                if (colors.has(eff.color)) return null; // Duplicate color
                colors.add(eff.color);
            }
        }

        // If wilds exist, they take missing colors.
        // Value = baseVal * count.
        return baseVal * tiles.length;
    }

    private calculateSetPoints(tiles: Tile[]): number | null {
        // Try Run
        const runPts = this.calculateSeriesPoints(tiles);
        if (runPts !== null) return runPts;

        // Try Group
        const groupPts = this.calculateGroupPoints(tiles);
        if (groupPts !== null) return groupPts;

        return null;
    }

    private calculatePairsPoints(tiles: Tile[]): number | null {
        // Pairs logic: [A, A] [B, B]
        // But input `tiles` here is likely "All pairs combined"? 
        // No, `openHand` payload likely sends `sets: Tile[][]`.
        // So this function validates ONE set.
        // Ideally, a "Pairs" open consists of MULTIPLE sets of 2.

        if (tiles.length !== 2) return null;

        const t1 = this.getEffectiveTile(tiles[0]);
        const t2 = this.getEffectiveTile(tiles[1]);

        // Check Validity
        // Color must match. Value must match.
        // Unless Wild.

        if (t1.isWild && t2.isWild) return 2; // Two jokers? Valid. Points?

        if (t1.isWild) {
            // Matches t2
            return 1; // Just return success (1 pair)
        }
        if (t2.isWild) {
            return 1;
        }

        if (t1.color === t2.color && t1.value === t2.value) {
            return 1;
        }

        return null;
    }

    // --- Action Handling ---

    public async handleAction(playerId: string, action: { type: string, payload?: any }) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        const player = this.players[playerIndex];

        // Turn check (mostly)
        // Opening hand can be done during turn? Yes.

        switch (action.type) {
            case 'DRAW_CENTER':
                if (playerIndex !== this.turnIndex) throw new Error("Sıra sende değil");
                if (player.hand.length !== 20) throw new Error("Zaten taş çektin mi?");
                this.drawFromCenter(playerIndex);
                break;

            case 'DRAW_LEFT':
                if (playerIndex !== this.turnIndex) throw new Error("Sıra sende değil");
                if (player.hand.length !== 20) throw new Error("Zaten taş çektin mi?");
                this.drawFromLeft(playerIndex);
                break;

            case 'DISCARD':
                if (playerIndex !== this.turnIndex) throw new Error("Sıra sende değil");
                if (player.hand.length !== 21) throw new Error("Taş atmadan önce taş çekmelisin");
                this.discardTile(playerIndex, action.payload.tileId);
                break;

            case 'OPEN_HAND':
                if (playerIndex !== this.turnIndex) throw new Error("Sıra sende değil");
                // Payload: { sets: number[][], type: 'series' | 'pairs' } 
                // containing arrays of Tile IDs.
                this.handleOpenHand(playerIndex, action.payload);
                break;

            case 'PROCESS_TILE':
                if (playerIndex !== this.turnIndex) throw new Error("Sıra sende değil");
                // Payload: { tileId: number, targetSetId: string, position: 'start'|'end' }
                // Adding a tile to an existing opened set
                // Only allowed if player has opened hand!
                if (!player.openned) throw new Error("Önce elini açmalısın");
                this.processTile(playerIndex, action.payload);
                break;

            case 'FINISH_GAME':
                this.finishGame(playerIndex, action.payload?.tileId);
                break;

            case 'RESTART_GAME':
                // Only allow if game is finished
                if (this.status === 'FINISHED') {
                    // Re-init game
                    this.initializeGame();
                    this.start();
                    this.onStateChange(this.getGameState());
                }
                break;
        }
    }

    private handleOpenHand(playerIndex: number, payload: { sets: number[][], type: 'series' | 'pairs' }) {
        const player = this.players[playerIndex];
        if (player.openned) throw new Error("Zaten elini açtın");

        const rawSets = payload.sets; // Arrays of IDs
        const tilesToRemove: Tile[] = [];
        const validatedSets: OpenedSet[] = [];
        let totalPoints = 0;
        let pairCount = 0;

        // Fetch actual tile objects
        for (const idGroup of rawSets) {
            const groupTiles: Tile[] = [];
            for (const id of idGroup) {
                const t = player.hand.find(x => x.id === id);
                if (!t) throw new Error("Taş elinde yok");
                // verify not used twice in payload?
                if (tilesToRemove.find(x => x.id === id)) throw new Error("Aynı taşı iki kere kullanamazsın");
                groupTiles.push(t);
                tilesToRemove.push(t);
            }

            if (payload.type === 'series') {
                const pts = this.calculateSetPoints(groupTiles);
                if (pts === null) throw new Error("Geçersiz seri veya grup");
                totalPoints += pts;

                validatedSets.push({
                    id: randomUUID(),
                    type: 'series',
                    tiles: groupTiles,
                    ownerId: player.id
                });
            } else {
                const valid = this.calculatePairsPoints(groupTiles);
                if (!valid) throw new Error("Geçersiz çift");
                pairCount++;

                validatedSets.push({
                    id: randomUUID(),
                    type: 'pairs',
                    tiles: groupTiles,
                    ownerId: player.id
                });
            }
        }

        // Final Check
        if (payload.type === 'series') {
            if (totalPoints < 101) throw new Error(`Yetersiz puan: ${totalPoints} (En az 101 gerekli)`);
        } else {
            if (pairCount < 5) throw new Error(`Yetersiz çift: ${pairCount} (En az 5 çift gerekli)`);
        }

        // Execute Open
        // Remove tiles from hand
        const removeIds = new Set(tilesToRemove.map(t => t.id));
        player.hand = player.hand.filter(t => !removeIds.has(t.id));

        player.openned = true;
        this.openedSets.push(...validatedSets);

        this.onStateChange(this.getGameState());
    }

    // Helper Method
    private drawTiles(count: number): Tile[] {
        const drawn: Tile[] = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length > 0) {
                drawn.push(this.deck.pop()!);
            }
        }
        return drawn;
    }

    private processTile(playerIndex: number, payload: { tileId: number, targetSetId: string, position?: 'start' | 'end' }) {
        // Logic to add a tile to an existing series/pair on the table
        const player = this.players[playerIndex];
        const tile = player.hand.find(t => t.id === payload.tileId);
        if (!tile) throw new Error("Taş yok");

        const targetSet = this.openedSets.find(s => s.id === payload.targetSetId);
        if (!targetSet) throw new Error("Set bulunamadı");

        // Validate addition
        const newTiles = [...targetSet.tiles];
        // Where to insert? 101 usually appends to ends.

        // Try appending
        let valid = false;

        // Try End
        if (this.calculateSetPoints([...newTiles, tile]) !== null) {
            targetSet.tiles.push(tile);
            valid = true;
        }
        // Try Start
        else if (this.calculateSetPoints([tile, ...newTiles]) !== null) {
            targetSet.tiles.unshift(tile);
            valid = true;
        }

        if (!valid) throw new Error("Taş bu sete işlenemez");

        // Remove from hand
        player.hand = player.hand.filter(t => t.id !== payload.tileId);

        this.onStateChange(this.getGameState());
    }

    private finishGame(playerIndex: number, finalTileId?: number) {
        // Finishing requirement: 
        // 1. Discard last tile.
        // 2. Remaining hand must be empty.

        const player = this.players[playerIndex];
        if (player.hand.length !== 1) throw new Error("Bitebilmek için elinde 1 taş kalmalı (son atılacak)");

        // Check valid discard
        // Usually you call DISCARD to finish. But separating FINISH action is fine.

        this.status = 'FINISHED';

        // Scoring
        const winner = this.players[playerIndex];
        let deduction = 101;

        if (finalTileId) {
            if (player.hand.some(t => t.id === finalTileId && this.isJoker(t))) {
                deduction += 20; // 101 + 20 = 121
            } else if (player.hand.some(t => t.id === finalTileId && this.isFakeJoker(t))) {
                deduction -= 20; // 101 - 20 = 81
            }
        }
        winner.score -= deduction;

        // Penalties for others
        this.players.forEach((p, idx) => {
            if (idx === playerIndex) return;

            if (p.openned) {
                // Sum of remaining tiles (Standard face value)
                let sum = 0;
                p.hand.forEach(t => sum += this.isJoker(t) ? 0 : t.value);
                p.score += sum;
            } else {
                // Not opened penalty: Sum of hand (per user request)
                let sum = 0;
                p.hand.forEach(t => sum += this.isJoker(t) ? 0 : t.value);
                p.score += sum;
            }
        });

        this.onStateChange({ ...this.getGameState(), winnerId: winner.id });
    }

    // --- Standard Methods (Copy from previous, simplified) ---

    private startTimer() {
        this.stopTimer();
        this.turnTimer = 30;
        this.timerInterval = setInterval(() => {
            if (this.status === 'FINISHED') {
                this.stopTimer();
                return;
            }
            this.turnTimer--;
            if (this.turnTimer <= 0) {
                this.handleTimeout();
            } else {
                // Optimization: Don't emit every second if not needed? 
                // Client sync?
                // Emitting every second is heavy. Client manages UI timer usually, syncs occasionally.
                // Keeping it for now.
                // this.onStateChange(this.getGameState());
            }
        }, 1000);
    }

    private stopTimer() { if (this.timerInterval) clearInterval(this.timerInterval); }

    private handleTimeout() {
        // Auto play logic
        const p = this.players[this.turnIndex];
        try {
            if (p.hand.length === 20) this.drawFromCenter(this.turnIndex);
            else if (p.hand.length === 21) {
                this.discardTile(this.turnIndex, p.hand[p.hand.length - 1].id);
            }
        } catch (e) {
            // force pass
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            this.startTimer();
            this.onStateChange(this.getGameState());
        }
    }

    private drawFromCenter(playerIndex: number) {
        if (this.deck.length === 0) {
            // reshuffle
            this.reshuffleDiscards();
            if (this.deck.length === 0) {
                this.status = 'FINISHED';
                this.onStateChange(this.getGameState());
                return;
            }
        }
        const tile = this.deck.pop();
        if (tile) {
            this.players[playerIndex].hand.push(tile);
            this.onStateChange(this.getGameState());
        }
    }

    private drawFromLeft(playerIndex: number) {
        const prevIdx = (playerIndex - 1 + this.players.length) % this.players.length;
        const tile = this.players[prevIdx].discards.pop();
        if (!tile) throw new Error("Taş yok");
        this.players[playerIndex].hand.push(tile);
        this.onStateChange(this.getGameState());
    }

    private discardTile(playerIndex: number, tileId: number) {
        const p = this.players[playerIndex];
        const idx = p.hand.findIndex(t => t.id === tileId);
        if (idx === -1) throw new Error("Taş yok");
        const tile = p.hand.splice(idx, 1)[0];
        p.discards.push(tile);
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.players.forEach((pp, i) => pp.isTurn = (i === this.turnIndex));

        this.startTimer();
        this.onStateChange(this.getGameState());
    }

    private reshuffleDiscards() {
        const allDiscards: Tile[] = [];
        this.players.forEach(p => { allDiscards.push(...p.discards); p.discards = []; });
        this.deck = allDiscards;
        this.shuffleDeck();
        this.onStateChange({ ...this.getGameState(), event: 'reshuffled' });
    }

    private createDeck(): Tile[] {
        const tiles: Tile[] = [];
        const colors: Color[] = ['red', 'black', 'blue', 'yellow'];
        let idCounter = 1;
        for (let i = 0; i < 2; i++) {
            for (const color of colors) {
                for (let val = 1; val <= 13; val++) {
                    tiles.push({ id: idCounter++, color, value: val });
                }
            }
        }
        // Fake Jokers
        tiles.push({ id: idCounter++, color: 'fake', value: 0 });
        tiles.push({ id: idCounter++, color: 'fake', value: 0 });
        return tiles;
    }

    private shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    private selectJoker() {
        if (this.deck.length > 0) this.indicator = this.deck.pop()!;
        else this.indicator = { id: -1, color: 'red', value: 1 }; // Fallback

        if (this.indicator.color === 'fake') {
            this.okeyTile = { id: -1, color: 'blue', value: 1 }; // Default fallback
        } else {
            let nextVal = this.indicator.value + 1;
            if (nextVal > 13) nextVal = 1;
            this.okeyTile = { id: -1, color: this.indicator.color, value: nextVal };
        }
    }

    public updatePlayerId(oldId: string, newId: string) {
        const p = this.players.find(x => x.id === oldId);
        if (p) p.id = newId;
        const idx = this.playerIds.indexOf(oldId);
        if (idx !== -1) this.playerIds[idx] = newId;
    }

    public getFullState(): GameState101 {
        return this.getGameState();
    }

    private getGameState(): GameState101 {
        return {
            players: this.players.map(p => ({ ...p })), // clone
            indicator: this.indicator,
            okeyTile: this.okeyTile,
            centerCount: this.deck.length,
            turnIndex: this.turnIndex,
            status: this.status,
            turnTimer: this.turnTimer,
            openedSets: this.openedSets,
            gameMode: '101'
        };
    }
}
