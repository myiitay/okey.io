import { HandValidator } from './HandValidator';

export type Color = 'red' | 'black' | 'blue' | 'yellow' | 'fake';
export type GameMode = 'standard' | '101';

export interface Tile {
    id: number;
    color: Color;
    value: number; // 1-13, or special for fake okey
}

export interface PlayerState {
    id: string;
    hand: Tile[];
    handCount: number;
    discards: Tile[];
    isTurn: boolean;
    hasShownIndicator?: boolean;
    openedSets?: Tile[][]; // For 101 mode
    sumOfOpened?: number;   // For 101 mode
}

export interface GameState {
    players: PlayerState[];
    indicator: Tile;
    okeyTile: Tile; // The logic tile that acts as joker
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED' | 'DRAW';
    mode: GameMode;
    winnerId?: string;
}

export class OkeyGame {
    private deck: Tile[] = [];
    private players: PlayerState[] = [];
    private playerIds: string[];
    private indicator!: Tile;
    private okeyTile!: Tile;
    private turnIndex: number = 0;
    private mode: GameMode;
    private status: 'PLAYING' | 'FINISHED' | 'DRAW' = 'PLAYING';
    private onStateChange: (state: GameState) => void;
    private onScoreUpdate?: (playerId: string, delta: number) => void;

    constructor(
        playerIds: string[],
        onStateChange: (state: GameState) => void,
        mode: GameMode = 'standard',
        onScoreUpdate?: (playerId: string, delta: number) => void
    ) {
        this.playerIds = playerIds;
        this.onStateChange = onStateChange;
        this.onScoreUpdate = onScoreUpdate;
        this.mode = mode;
        this.initializeGame();
    }

    private initializeGame() {
        this.deck = this.createDeck();
        this.shuffleDeck();

        // Random starter
        this.turnIndex = Math.floor(Math.random() * this.playerIds.length);

        const standardCount = 14;
        const starterCount = 15;

        this.players = this.playerIds.map((id, index) => {
            const count = index === this.turnIndex ? starterCount : standardCount;
            const hand = this.drawTiles(count);
            return {
                id,
                hand,
                handCount: hand.length,
                discards: [],
                isTurn: index === this.turnIndex,
                hasShownIndicator: false,
                openedSets: this.mode === '101' ? [] : undefined,
                sumOfOpened: this.mode === '101' ? 0 : undefined
            };
        });
    }

    public start(): GameState {
        this.selectJoker();
        return this.getGameState();
    }

    private selectJoker() {
        if (this.deck.length > 0) {
            this.indicator = this.deck.pop()!;
        } else {
            this.indicator = { id: -1, color: 'red', value: 1 };
        }

        if (this.indicator.color === 'fake') {
            this.okeyTile = { id: -1, color: 'red', value: 1 };
        } else {
            let nextVal = this.indicator.value + 1;
            if (nextVal > 13) nextVal = 1;
            this.okeyTile = { id: -1, color: this.indicator.color, value: nextVal };
        }
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

    private drawTiles(count: number): Tile[] {
        const drawn: Tile[] = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length > 0) {
                drawn.push(this.deck.pop()!);
            }
        }
        return drawn;
    }

    public handleAction(playerId: string, action: { type: string, payload?: any }) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;

        if (playerIndex !== this.turnIndex) {
            throw new Error("Not your turn");
        }

        const player = this.players[playerIndex];

        switch (action.type) {
            case 'SHOW_INDICATOR':
                this.showIndicator(playerIndex);
                break;
            case 'OPEN_HAND':
                if (this.mode !== '101') throw new Error("Only for 101 mode");
                this.openHand(playerIndex);
                break;
            case 'ADD_TO_SET':
                if (this.mode !== '101') throw new Error("Only for 101 mode");
                this.addToSet(playerIndex, action.payload);
                break;
            case 'DRAW_CENTER':
                if (player.hand.length !== 14) throw new Error("Did you already draw?");
                this.drawFromCenter(playerIndex);
                break;
            case 'DRAW_LEFT':
                if (player.hand.length !== 14) throw new Error("Did you already draw?");
                this.drawFromLeft(playerIndex);
                break;
            case 'DISCARD':
                if (player.hand.length !== 15) throw new Error("You must draw before discarding");
                if (!action.payload || !action.payload.tileId) throw new Error("Missing tileId");
                this.discardTile(playerIndex, action.payload.tileId);
                break;
            case 'FINISH_GAME':
                if (player.hand.length !== 15) throw new Error("Invalid state");
                if (this.mode === '101' && (!player.openedSets || player.openedSets.length === 0)) {
                    throw new Error("You must open your hand before finishing in 101!");
                }

                const finishTileId = action.payload?.tileId;
                if (!finishTileId) throw new Error("Select a tile to finish with");

                const finishTileIdx = player.hand.findIndex(t => t.id === finishTileId);
                if (finishTileIdx === -1) throw new Error("Tile not found");

                const remainingHand = [...player.hand];
                remainingHand.splice(finishTileIdx, 1);

                const isValid = HandValidator.validateHand(remainingHand, this.okeyTile);

                if (isValid) {
                    this.status = 'FINISHED';
                    player.isTurn = false;

                    // Update scores for 101
                    const resultState = this.getGameState();
                    if (this.mode === '101') {
                        resultState.players.forEach(p => {
                            if (p.id === playerId) {
                                // Winner gets +101
                                this.onScoreUpdate?.(p.id, 101);
                            } else if (!this.players.find(realP => realP.id === p.id)?.openedSets?.length) {
                                // Unopened players get -101
                                this.onScoreUpdate?.(p.id, -101);
                            }
                        });
                    }

                    this.onStateChange({ ...resultState, winnerId: playerId });
                } else {
                    throw new Error("Hand is not a winning hand!");
                }
                break;
        }
    }

    private openHand(playerIndex: number) {
        const player = this.players[playerIndex];
        if (player.openedSets && player.openedSets.length > 0) throw new Error("Hand already opened");

        const result = HandValidator.findBestSets(player.hand, this.okeyTile);
        if (result.sum < 101) throw new Error(`Insufficient sum: ${result.sum}/101`);

        // Transfer tiles to openedSets
        player.openedSets = result.sets;
        player.sumOfOpened = result.sum;

        // Remove those tiles from hand
        const openedTileIds = new Set(result.sets.flat().map(t => t.id));
        player.hand = player.hand.filter(t => !openedTileIds.has(t.id));
        player.handCount = player.hand.length;

        this.onStateChange(this.getGameState());
    }

    private addToSet(playerIndex: number, payload: { tileId: number, targetPlayerId: string, setIndex: number }) {
        const player = this.players[playerIndex];
        if (!player.openedSets || player.openedSets.length === 0) throw new Error("You must open your hand before processing tiles to the table!");

        const targetPlayer = this.players.find(p => p.id === payload.targetPlayerId);
        if (!targetPlayer || !targetPlayer.openedSets || !targetPlayer.openedSets[payload.setIndex]) throw new Error("Target set not found");

        const tileIdx = player.hand.findIndex(t => t.id === payload.tileId);
        if (tileIdx === -1) throw new Error("Tile not in hand");

        const tile = player.hand[tileIdx];
        const targetSet = targetPlayer.openedSets[payload.setIndex];

        // Basic validation: Is it a valid addition?
        const newSet = [...targetSet, tile];
        // TODO: More sophisticated validation (sorting for runs etc)
        // For now, if it's a group, must match value. If run, must match color and be ±1

        targetSet.push(tile); // Simplified: Assume valid if UI allows it
        player.hand.splice(tileIdx, 1);
        player.handCount = player.hand.length;

        this.onStateChange(this.getGameState());
    }

    private showIndicator(playerIndex: number) {
        const player = this.players[playerIndex];
        if (player.hasShownIndicator) throw new Error("Already shown indicator");

        const hasTile = player.hand.some(t => t.color === this.indicator.color && t.value === this.indicator.value);
        if (!hasTile) throw new Error("You don't have the indicator tile!");

        player.hasShownIndicator = true;
        this.onStateChange(this.getGameState());
    }

    private drawFromCenter(playerIndex: number) {
        if (this.deck.length === 0) {
            this.status = 'DRAW';
            this.onStateChange(this.getGameState());
            return;
        }
        const tile = this.deck.pop()!;
        this.players[playerIndex].hand.push(tile);
        this.players[playerIndex].handCount = this.players[playerIndex].hand.length;
        this.onStateChange(this.getGameState());
    }

    private drawFromLeft(playerIndex: number) {
        const prevIndex = (playerIndex - 1 + this.players.length) % this.players.length;
        const prevPlayer = this.players[prevIndex];

        if (prevPlayer.discards.length === 0) throw new Error("No tile to draw from left");

        // Handle 101 rule: Can only draw from left IF it helps you open
        const tile = prevPlayer.discards.pop()!;
        this.players[playerIndex].hand.push(tile);
        this.players[playerIndex].handCount = this.players[playerIndex].hand.length;
        this.onStateChange(this.getGameState());
    }

    private discardTile(playerIndex: number, tileId: number) {
        const handIndex = this.players[playerIndex].hand.findIndex(t => t.id === tileId);
        if (handIndex === -1) throw new Error("Tile not in hand");

        const tile = this.players[playerIndex].hand.splice(handIndex, 1)[0];
        this.players[playerIndex].handCount = this.players[playerIndex].hand.length;
        this.players[playerIndex].discards.push(tile);

        this.players[playerIndex].isTurn = false;
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.players[this.turnIndex].isTurn = true;

        this.onStateChange(this.getGameState());
    }

    public getFullState(): GameState {
        return this.getGameState();
    }

    public getSanitizedState(playerId: string): GameState {
        const fullState = this.getGameState();
        return {
            ...fullState,
            players: fullState.players.map(p => ({
                ...p,
                hand: (p.id === playerId || this.status === 'FINISHED')
                    ? p.hand
                    : [],
                handCount: p.hand.length
            }))
        };
    }

    private getGameState(): GameState {
        return {
            players: this.players.map(p => {
                let potentialSum = p.sumOfOpened;
                if (this.mode === '101' && (!p.openedSets || p.openedSets.length === 0)) {
                    // Only calculate if not yet opened
                    potentialSum = HandValidator.findBestSets(p.hand, this.okeyTile).sum;
                }

                return {
                    id: p.id,
                    hand: p.hand,
                    handCount: p.hand.length,
                    discards: p.discards,
                    isTurn: p.isTurn,
                    hasShownIndicator: p.hasShownIndicator,
                    openedSets: p.openedSets,
                    sumOfOpened: potentialSum
                };
            }),
            indicator: this.indicator,
            okeyTile: this.okeyTile,
            centerCount: this.deck.length,
            turnIndex: this.turnIndex,
            status: this.status,
            mode: this.mode
        };
    }
}
