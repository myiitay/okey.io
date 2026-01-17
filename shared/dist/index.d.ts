export type Color = 'red' | 'black' | 'blue' | 'yellow' | 'fake';
export interface Tile {
    id: number;
    color: Color;
    value: number;
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
    okeyTile: Tile;
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED';
    winnerId?: string;
    winType?: 'normal' | 'double';
    turnTimer: number;
    event?: 'reshuffled';
}
export interface RoomSettings {
    turnTime: number;
    targetScore: number;
    isPublic: boolean;
    isPaired?: boolean;
}
export interface Player {
    id: string;
    token: string;
    name: string;
    avatar: string;
    frameId?: string;
    roomId?: string;
    connected: boolean;
    disconnectTime?: number;
    isBot?: boolean;
    isReady?: boolean;
    team?: 1 | 2;
}
export interface RoomPublic {
    id: string;
    count: number;
    max: number;
    status: 'Playing' | 'Waiting';
    mode: '101' | 'standard';
}
export interface RoomData {
    id: string;
    players: {
        name: string;
        id: string;
        avatar: string;
        frameId?: string;
        readyToRestart: boolean;
        connected: boolean;
        isReady?: boolean;
        isBot?: boolean;
        team?: 1 | 2;
    }[];
    winScores: {
        [key: string]: number;
    };
    restartCount: number;
    gameStarted: boolean;
    gameMode: '101' | 'standard';
    settings: RoomSettings;
}
export * from './schemas';
export * from './types101';
