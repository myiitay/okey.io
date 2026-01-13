export interface TileData {
    id: number;
    color: 'red' | 'black' | 'blue' | 'yellow' | 'fake';
    value: number;
}

export interface GameState {
    players: any[];
    indicator: TileData;
    okeyTile: TileData;
    centerCount: number;
    turnIndex: number;
    status: 'PLAYING' | 'FINISHED';
    winnerId?: string;
}
