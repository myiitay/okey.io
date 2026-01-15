export interface TileData {
    id: number;
    color: 'red' | 'black' | 'blue' | 'yellow' | 'fake';
    value: number;
}

export interface PlayerState {
    id: string;
    hand: TileData[];
    discards: TileData[];
    isTurn: boolean;
}

export interface GameState {
    players: PlayerState[];
    indicator: TileData;
    okeyTile: TileData;
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED';
    winnerId?: string;
}

export interface RoomPlayer {
    id: string;
    name: string;
    avatar: string;
    connected: boolean;
    isReady?: boolean;
    isBot?: boolean;
    readyToRestart?: boolean;
}

export interface RoomSettings {
    turnTime: number;
    targetScore: number;
    isPublic: boolean;
}

export interface RoomData {
    id: string;
    players: RoomPlayer[];
    winScores: Record<string, number>;
    restartCount: number;
    gameStarted: boolean;
    gameMode: '101' | 'standard';
    settings: RoomSettings;
}
