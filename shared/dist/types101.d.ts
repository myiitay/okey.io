import { Tile, PlayerState, GameState } from './index';
export interface OpenedSet {
    id: string;
    type: 'series' | 'pairs';
    tiles: Tile[];
    ownerId: string;
}
export interface PlayerState101 extends PlayerState {
    openned: boolean;
    score: number;
}
export interface GameState101 extends Omit<GameState, 'players'> {
    players: PlayerState101[];
    openedSets: OpenedSet[];
    gameMode: '101';
}
