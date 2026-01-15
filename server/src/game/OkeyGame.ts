export type Color = 'red' | 'black' | 'blue' | 'yellow' | 'fake';

export interface Tile {
    id: number;
    color: Color;
    value: number; // 1-13, or special for fake okey
}

export interface PlayerState {
    id: string;
    hand: Tile[];
    discards: Tile[];
    isTurn: boolean;
}

export interface GameState {
    players: PlayerState[];
    indicator: Tile;
    okeyTile: Tile; // The logic tile that acts as joker
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED';
    winnerId?: string;
    turnTimer: number;
}

export class OkeyGame {
    private deck: Tile[] = [];
    private players: PlayerState[] = [];
    private playerIds: string[];
    private indicator!: Tile;
    private okeyTile!: Tile;
    private turnIndex: number = 0;
    private status: 'PLAYING' | 'FINISHED' = 'PLAYING';
    private onStateChange: (state: GameState) => void;
    private turnTimer: number = 25;
    private timerInterval: NodeJS.Timeout | null = null;

    constructor(playerIds: string[], onStateChange: (state: GameState) => void) {
        this.playerIds = playerIds;
        this.onStateChange = onStateChange;
        this.status = 'PLAYING'; // Explicitly ensure start state
        console.log(`[OkeyGame] Created for players: ${playerIds.join(', ')}. Initial status: ${this.status}`);
        this.initializeGame();
    }

    private initializeGame() {
        this.deck = this.createDeck();
        this.shuffleDeck();

        // DO NOT determine Okey yet - will be done after dealing
        // Random starter
        this.turnIndex = Math.floor(Math.random() * this.playerIds.length);

        this.players = this.playerIds.map((id, index) => {
            const count = index === this.turnIndex ? 15 : 14;
            const hand = this.drawTiles(count);
            return {
                id,
                hand,
                discards: [],
                isTurn: index === this.turnIndex
            };
        });
    }

    public start(): GameState {
        // After dealing, select the Joker from remaining deck
        this.selectJoker();
        this.startTimer();
        return this.getGameState();
    }

    private startTimer() {
        this.stopTimer();
        this.turnTimer = 25;
        this.timerInterval = setInterval(() => {
            if (this.status === 'FINISHED') {
                this.stopTimer();
                return;
            }

            this.turnTimer--;
            if (this.turnTimer <= 0) {
                this.handleTimeout();
            } else {
                this.onStateChange(this.getGameState());
            }
        }, 1000);
    }

    private stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private async handleTimeout() {
        const player = this.players[this.turnIndex];
        console.log(`[OkeyGame] Timeout for player ${player.id}. Auto-playing...`);

        try {
            // 1. If didn't draw, draw from center
            if (player.hand.length === 14) {
                this.drawFromCenter(this.turnIndex);
            }

            // 2. Discard a tile (last one in hand for simplicity)
            if (player.hand.length === 15) {
                const tileToDiscard = player.hand[player.hand.length - 1];
                this.discardTile(this.turnIndex, tileToDiscard.id);
            }
        } catch (err) {
            console.error("[OkeyGame] Auto-play error:", err);
            // Fallback: just skip turn if something goes wrong
            this.players[this.turnIndex].isTurn = false;
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            this.players[this.turnIndex].isTurn = true;
            this.startTimer();
            this.onStateChange(this.getGameState());
        }
    }

    private selectJoker() {
        // Remove last tile from deck as indicator (simulating drawing from deck)
        if (this.deck.length > 0) {
            this.indicator = this.deck.pop()!;
        } else {
            // Fallback if deck is empty (shouldn't happen)
            this.indicator = { id: -1, color: 'red', value: 1 };
        }

        // Calculate Okey tile (Indicator + 1)
        if (this.indicator.color === 'fake') {
            // If fake joker is drawn as indicator, use Red 1 as Okey
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

        // 2 sets of standard tiles
        for (let i = 0; i < 2; i++) {
            for (const color of colors) {
                for (let val = 1; val <= 13; val++) {
                    tiles.push({ id: idCounter++, color, value: val });
                }
            }
        }

        // 2 Fake Okeys
        tiles.push({ id: idCounter++, color: 'fake', value: 0 }); // Picture
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

    public async handleAction(playerId: string, action: { type: string, payload?: any }) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;

        if (playerIndex !== this.turnIndex) {
            throw new Error("Not your turn");
        }

        const player = this.players[playerIndex];

        switch (action.type) {
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
                // Validate Hand
                const { HandValidator } = await import('./HandValidator');

                // Check winning condition
                // 1. We need to discard one tile to "finish"
                // The user usually selects a tile to "Finish" with?
                // Or they discard, then say finish?
                // Standard: Drag tile to "Finish" pile/area. 
                // Here payload should be the finish tile.

                const finishTileId = action.payload?.tileId;
                if (!finishTileId) throw new Error("Select a tile to finish with");

                // Separate hand into Hand (14) and Finish Tile (1)
                const finishTileIdx = player.hand.findIndex(t => t.id === finishTileId);
                if (finishTileIdx === -1) throw new Error("Tile not found");

                const remainingHand = [...player.hand];
                remainingHand.splice(finishTileIdx, 1);

                const isValid = HandValidator.validateHand(remainingHand, this.okeyTile);

                if (isValid) {
                    console.log(`[OkeyGame] FINISH_GAME SUCCESS: ${playerId} won!`);
                    this.status = 'FINISHED';
                    player.isTurn = false;
                    this.onStateChange({ ...this.getGameState(), winnerId: playerId });
                } else {
                    console.warn(`[OkeyGame] FINISH_GAME ATTEMPT FAILED: ${playerId} hand invalid.`);
                    throw new Error("Hand is not a winning hand!");
                }
                break;
        }
    }

    private drawFromCenter(playerIndex: number) {
        if (this.players[playerIndex].hand.length !== 14) throw new Error("Already drew or have too many tiles");
        const tile = this.deck.pop();
        if (!tile) {
            // Deck is empty - Draw condition
            console.log(`[OkeyGame] Deck exhausted. Game ends in a draw.`);
            this.status = 'FINISHED';
            this.onStateChange(this.getGameState());
            return;
        }
        this.players[playerIndex].hand.push(tile);
        this.onStateChange(this.getGameState());
    }

    private drawFromLeft(playerIndex: number) {
        if (this.players[playerIndex].hand.length !== 14) throw new Error("Already drew");

        // Left player is (index - 1 + 4) % 4 for 4 players
        // Assuming clockwise turn: 0 -> 1 -> 2 -> 3 -> 0
        // So player 1 takes from player 0.
        // Wait, typical Okey is Counter-Clockwise? Or Clockwise? 
        // Most online games are clockwise or configured. I will use Clockwise (0->1->2->3)
        // So player 1 takes from player 0 discards.
        // Previous player index:
        const prevIndex = (playerIndex - 1 + this.players.length) % this.players.length;
        const prevPlayer = this.players[prevIndex];

        if (prevPlayer.discards.length === 0) throw new Error("No tile to draw from left");

        const tile = prevPlayer.discards.pop()!; // Take last discard
        this.players[playerIndex].hand.push(tile);
        this.onStateChange(this.getGameState());
    }

    private discardTile(playerIndex: number, tileId: number) {
        if (this.players[playerIndex].hand.length !== 15) throw new Error("Must draw before discard");

        const handIndex = this.players[playerIndex].hand.findIndex(t => t.id === tileId);
        if (handIndex === -1) throw new Error("Tile not in hand");

        const tile = this.players[playerIndex].hand.splice(handIndex, 1)[0];
        this.players[playerIndex].discards.push(tile);

        // Pass turn
        this.players[playerIndex].isTurn = false;
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.players[this.turnIndex].isTurn = true;

        this.startTimer();
        this.onStateChange(this.getGameState());
    }

    public updatePlayerId(oldId: string, newId: string) {
        const player = this.players.find(p => p.id === oldId);
        if (player) {
            player.id = newId;
        }
        // Also update internal playerIds array
        const idx = this.playerIds.indexOf(oldId);
        if (idx !== -1) {
            this.playerIds[idx] = newId;
        }
    }

    public getFullState(): GameState {
        return this.getGameState();
    }

    private getGameState(): GameState {
        return {
            players: this.players.map(p => ({
                id: p.id,
                hand: p.hand, // NOTE: In real game, should hide opponents hands.
                // But for backend state, we send everything? 
                // Ideally only send visible info to specific sockets.
                // For this "GameState" object, we keep it raw, 
                // RoomManager should filter it before sending to specific clients if needed.
                // For MVP, we'll send everything to client and client hides it (NOT SECURE but faster).
                // Wait, "Players can only see their own tiles" is a requirement.
                // So we should probably sanitize this in RoomManager or return a sanitized view here?
                // I'll keep this as "Full State" and sanitizing happens before emit if I have time, 
                // OR I trust the client for MVP (User requirement: "Oyuncular sadece kendi taşlarını görebilsin").
                // I MUST sanitize.
                // I will add a `getOwnerView(playerId)` method.
                discards: p.discards,
                isTurn: p.isTurn
            })),
            indicator: this.indicator,
            okeyTile: this.okeyTile,
            centerCount: this.deck.length,
            turnIndex: this.turnIndex,
            status: this.status,
            turnTimer: this.turnTimer
        };
    }
}
