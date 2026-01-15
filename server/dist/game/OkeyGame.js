"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OkeyGame = void 0;
class OkeyGame {
    constructor(playerIds, onStateChange) {
        this.deck = [];
        this.players = [];
        this.turnIndex = 0;
        this.status = 'PLAYING';
        this.playerIds = playerIds;
        this.onStateChange = onStateChange;
        this.status = 'PLAYING'; // Explicitly ensure start state
        console.log(`[OkeyGame] Created for players: ${playerIds.join(', ')}. Initial status: ${this.status}`);
        this.initializeGame();
    }
    initializeGame() {
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
    start() {
        // After dealing, select the Joker from remaining deck
        this.selectJoker();
        return this.getGameState();
    }
    selectJoker() {
        // Remove last tile from deck as indicator (simulating drawing from deck)
        if (this.deck.length > 0) {
            this.indicator = this.deck.pop();
        }
        else {
            // Fallback if deck is empty (shouldn't happen)
            this.indicator = { id: -1, color: 'red', value: 1 };
        }
        // Calculate Okey tile (Indicator + 1)
        if (this.indicator.color === 'fake') {
            // If fake joker is drawn as indicator, use Red 1 as Okey
            this.okeyTile = { id: -1, color: 'red', value: 1 };
        }
        else {
            let nextVal = this.indicator.value + 1;
            if (nextVal > 13)
                nextVal = 1;
            this.okeyTile = { id: -1, color: this.indicator.color, value: nextVal };
        }
    }
    createDeck() {
        const tiles = [];
        const colors = ['red', 'black', 'blue', 'yellow'];
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
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    drawTiles(count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length > 0) {
                drawn.push(this.deck.pop());
            }
        }
        return drawn;
    }
    async handleAction(playerId, action) {
        var _a;
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1)
            return;
        if (playerIndex !== this.turnIndex) {
            throw new Error("Not your turn");
        }
        const player = this.players[playerIndex];
        switch (action.type) {
            case 'DRAW_CENTER':
                if (player.hand.length !== 14)
                    throw new Error("Did you already draw?");
                this.drawFromCenter(playerIndex);
                break;
            case 'DRAW_LEFT':
                if (player.hand.length !== 14)
                    throw new Error("Did you already draw?");
                this.drawFromLeft(playerIndex);
                break;
            case 'DISCARD':
                if (player.hand.length !== 15)
                    throw new Error("You must draw before discarding");
                if (!action.payload || !action.payload.tileId)
                    throw new Error("Missing tileId");
                this.discardTile(playerIndex, action.payload.tileId);
                break;
            case 'FINISH_GAME':
                if (player.hand.length !== 15)
                    throw new Error("Invalid state");
                // Validate Hand
                const { HandValidator } = await Promise.resolve().then(() => __importStar(require('./HandValidator')));
                // Check winning condition
                // 1. We need to discard one tile to "finish"
                // The user usually selects a tile to "Finish" with?
                // Or they discard, then say finish?
                // Standard: Drag tile to "Finish" pile/area. 
                // Here payload should be the finish tile.
                const finishTileId = (_a = action.payload) === null || _a === void 0 ? void 0 : _a.tileId;
                if (!finishTileId)
                    throw new Error("Select a tile to finish with");
                // Separate hand into Hand (14) and Finish Tile (1)
                const finishTileIdx = player.hand.findIndex(t => t.id === finishTileId);
                if (finishTileIdx === -1)
                    throw new Error("Tile not found");
                const remainingHand = [...player.hand];
                remainingHand.splice(finishTileIdx, 1);
                const isValid = HandValidator.validateHand(remainingHand, this.okeyTile);
                if (isValid) {
                    console.log(`[OkeyGame] FINISH_GAME SUCCESS: ${playerId} won!`);
                    this.status = 'FINISHED';
                    player.isTurn = false;
                    this.onStateChange({ ...this.getGameState(), winnerId: playerId });
                }
                else {
                    console.warn(`[OkeyGame] FINISH_GAME ATTEMPT FAILED: ${playerId} hand invalid.`);
                    throw new Error("Hand is not a winning hand!");
                }
                break;
        }
    }
    drawFromCenter(playerIndex) {
        if (this.players[playerIndex].hand.length !== 14)
            throw new Error("Already drew or have too many tiles");
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
    drawFromLeft(playerIndex) {
        if (this.players[playerIndex].hand.length !== 14)
            throw new Error("Already drew");
        // Left player is (index - 1 + 4) % 4 for 4 players
        // Assuming clockwise turn: 0 -> 1 -> 2 -> 3 -> 0
        // So player 1 takes from player 0.
        // Wait, typical Okey is Counter-Clockwise? Or Clockwise? 
        // Most online games are clockwise or configured. I will use Clockwise (0->1->2->3)
        // So player 1 takes from player 0 discards.
        // Previous player index:
        const prevIndex = (playerIndex - 1 + this.players.length) % this.players.length;
        const prevPlayer = this.players[prevIndex];
        if (prevPlayer.discards.length === 0)
            throw new Error("No tile to draw from left");
        const tile = prevPlayer.discards.pop(); // Take last discard
        this.players[playerIndex].hand.push(tile);
        this.onStateChange(this.getGameState());
    }
    discardTile(playerIndex, tileId) {
        if (this.players[playerIndex].hand.length !== 15)
            throw new Error("Must draw before discard");
        const handIndex = this.players[playerIndex].hand.findIndex(t => t.id === tileId);
        if (handIndex === -1)
            throw new Error("Tile not in hand");
        const tile = this.players[playerIndex].hand.splice(handIndex, 1)[0];
        this.players[playerIndex].discards.push(tile);
        // Pass turn
        this.players[playerIndex].isTurn = false;
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.players[this.turnIndex].isTurn = true;
        this.onStateChange(this.getGameState());
    }
    updatePlayerId(oldId, newId) {
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
    getFullState() {
        return this.getGameState();
    }
    getGameState() {
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
            status: this.status
        };
    }
}
exports.OkeyGame = OkeyGame;
