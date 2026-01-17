import { Tile, PlayerState, GameState } from './index';

export interface OpenedSet {
    id: string; // unique ID for the set on table
    type: 'series' | 'pairs';
    tiles: Tile[];
    ownerId: string; // The player who opened this
}

export interface PlayerState101 extends PlayerState {
    openned: boolean; // Has the player opened their hand?
    score: number; // Current penalty points
}

export interface GameState101 extends Omit<GameState, 'players'> {
    players: PlayerState101[];
    openedSets: OpenedSet[]; // Sets on the table
    gameMode: '101';
}
