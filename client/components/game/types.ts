export type Color = 'red' | 'black' | 'blue' | 'yellow' | 'fake';
export type GameMode = 'standard' | '101';

export interface TileData {
    id: number;
    color: Color;
    value: number;
}

export interface PlayerState {
    id: string;
    hand: TileData[];
    handCount: number;
    discards: TileData[];
    isTurn: boolean;
    hasShownIndicator?: boolean;
    openedSets?: TileData[][];
    sumOfOpened?: number;
}

export interface GameState {
    players: PlayerState[];
    indicator: TileData;
    okeyTile: TileData;
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED' | 'DRAW';
    mode: GameMode;
    winnerId?: string;
}
