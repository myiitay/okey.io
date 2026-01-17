import { Tile, GameState as SharedGameState, PlayerState as SharedPlayerState, RoomSettings as SharedRoomSettings, RoomData as SharedRoomData, Player } from '@okey/shared';

export type TileData = Tile;

export type PlayerState = SharedPlayerState;

export type GameState = SharedGameState;

// RoomPlayer matches one element of the RoomData.players array
export type RoomPlayer = SharedRoomData['players'][number];

export type RoomSettings = SharedRoomSettings;

export type RoomData = SharedRoomData;

export type GameState101 = import('@okey/shared').GameState101;
export type OpenedSet = import('@okey/shared').OpenedSet;
