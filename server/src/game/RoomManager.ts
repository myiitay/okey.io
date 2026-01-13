import { Server, Socket } from 'socket.io';
import { OkeyGame, GameState } from './OkeyGame';

interface Room {
    id: string;
    players: Player[];
    game?: OkeyGame;
    maxPlayers: number;
    bannedPlayers: Set<string>;
    winScores: Map<string, number>; // Name -> Score
    restartVotes: Set<string>; // Socket ID
}

interface Player {
    id: string; // Socket ID
    name: string;
    avatar: string;
    roomId?: string;
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private players: Map<string, Player> = new Map();
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    // Generate a random 4-digit numeric code
    private generateRoomCode(): string {
        let code = '';
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (this.rooms.has(code));
        return code;
    }

    public handleConnection(socket: Socket) {
        console.log(`User connected: ${socket.id}`);

        socket.on('joinLobby', (name: string) => {
            // Basic join lobby if needed
        });

        socket.on('createRoom', (payload: { name: string, avatar?: string } | string) => {
            let name = "";
            let avatar = "👤"; // Default

            if (typeof payload === 'string') {
                name = payload;
            } else if (payload && typeof payload === 'object') {
                name = payload.name;
                if (payload.avatar) avatar = payload.avatar;
            }

            if (!name) {
                socket.emit('error', 'Nickname is required');
                return;
            }

            // Auto-register if name provided
            if (name) {
                this.players.set(socket.id, { id: socket.id, name, avatar });
            }

            const player = this.players.get(socket.id);
            if (!player) {
                socket.emit('error', 'Player not found. Please refresh.');
                return;
            }

            const code = this.generateRoomCode();
            const room: Room = {
                id: code,
                players: [player],
                maxPlayers: 4,
                bannedPlayers: new Set(),
                winScores: new Map(),
                restartVotes: new Set()
            };

            this.rooms.set(code, room);
            player.roomId = code;

            socket.join(code);
            socket.emit('roomCreated', code);
            this.io.to(code).emit('updateRoom', this.getRoomData(code));
        });

        socket.on('checkRoom', (code: string) => {
            const room = this.rooms.get(code);
            if (room) {
                socket.emit('updateRoom', this.getRoomData(code));
            } else {
                socket.emit('error', 'Room not found');
            }
        });

        socket.on('joinRoom', (payload: { code: string, name: string, avatar?: string }) => {
            const { code, name, avatar } = payload;

            // Auto-register
            if (name) {
                this.players.set(socket.id, {
                    id: socket.id,
                    name,
                    avatar: avatar || "👤"
                });
            }

            const player = this.players.get(socket.id);
            const room = this.rooms.get(code);

            if (!player) {
                socket.emit('error', 'Player session error. Refresh page.');
                return;
            }
            if (!room) {
                socket.emit('error', 'Room not found');
                return;
            }

            // Check Ban List (Ban by name for now, strictly speaking should be IP/DeviceID but name is MVP)
            if (room.bannedPlayers.has(name)) {
                socket.emit('error', 'You are banned from this room.');
                return;
            }

            // Check if already in room to prevent dupes
            if (room.players.find(p => p.id === player.id)) {
                socket.emit('updateRoom', this.getRoomData(code));
                return;
            }

            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', 'Room is full');
                return;
            }

            if (room.game) {
                socket.emit('error', 'Game already started');
                return;
            }

            room.players.push(player);
            player.roomId = code;
            socket.join(code);

            socket.emit('joinedRoom', code); // Confirm join to sender
            this.io.to(code).emit('updateRoom', this.getRoomData(code));
        });

        // KICK PLAYER
        socket.on('kickPlayer', (targetId: string) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            // Only host can kick (Host is index 0)
            if (room.players[0].id !== player.id) {
                socket.emit('error', 'Only host can kick players.');
                return;
            }
            // Cannot kick self
            if (targetId === player.id) return;

            const target = this.players.get(targetId);
            if (target && target.roomId === room.id) {
                // Determine logic: Remove from room, emit kicked event to target
                room.players = room.players.filter(p => p.id !== targetId);

                // Notify target
                this.io.to(targetId).emit('kicked', 'You have been kicked from the room.');

                // Make target leave socket room
                const targetSocket = this.io.sockets.sockets.get(targetId);
                if (targetSocket) {
                    targetSocket.leave(room.id);
                }
                if (target) target.roomId = undefined;

                this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            }
        });

        // BAN PLAYER
        socket.on('banPlayer', (targetId: string) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            if (room.players[0].id !== player.id) {
                socket.emit('error', 'Only host can ban players.');
                return;
            }
            if (targetId === player.id) return;

            const target = this.players.get(targetId);
            if (target && target.roomId === room.id) {
                // Add to ban list (Name)
                room.bannedPlayers.add(target.name);

                room.players = room.players.filter(p => p.id !== targetId);

                this.io.to(targetId).emit('banned', 'You have been banned from this room.');

                const targetSocket = this.io.sockets.sockets.get(targetId);
                if (targetSocket) {
                    targetSocket.leave(room.id);
                }
                if (target) target.roomId = undefined;

                this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            }
        });

        socket.on('startGame', () => {
            console.log(`[startGame] Request from ${socket.id}`);
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) {
                console.log(`[startGame] Player or RoomId not found for ${socket.id}`);
                return;
            }

            const room = this.rooms.get(player.roomId);
            if (!room) {
                console.log(`[startGame] Room ${player.roomId} not found`);
                return;
            }

            if (room.players[0].id !== player.id) {
                socket.emit('error', 'Only the host can start the game');
                return;
            }

            if (room.players.length !== 2 && room.players.length !== 4) {
                socket.emit('error', 'Game requires exactly 2 or 4 players');
                return;
            }

            if (room.game) {
                socket.emit('error', 'Game already started');
                return;
            }

            // Start Countdown sequence
            console.log(`Starting countdown in room ${room.id}`);
            this.io.to(room.id).emit('roomCountdown', 3); // 3 seconds

            // Wait 3s then start
            setTimeout(() => {
                // Re-check room state after delay (players might have left)
                if (!this.rooms.has(room.id) || room.players.length < 1) return;

                console.log(`Starting game in room ${room.id} with ${room.players.length} players`);
                try {
                    room.game = new OkeyGame(room.players.map(p => p.id), (gameState: GameState) => {
                        // Handle win detection for scores
                        if (gameState.status === 'FINISHED' && gameState.winnerId) {
                            const winner = this.players.get(gameState.winnerId);
                            if (winner) {
                                const currentScore = room.winScores.get(winner.name) || 0;
                                room.winScores.set(winner.name, currentScore + 1);
                                this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                            }
                        }
                        this.io.to(room.id).emit('gameState', gameState);
                    });

                    const initialState = room.game.start();
                    console.log(`[startGame] Game started, emitting to ${room.id}`);

                    room.restartVotes.clear(); // Reset votes for next turn

                    // Emit game started (Joker is already selected in start(), but client will show animation)
                    this.io.to(room.id).emit('gameStarted', initialState);
                    this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

                    // After 3 more seconds (for dealing animation), emit Joker reveal
                    setTimeout(() => {
                        if (room.game) {
                            this.io.to(room.id).emit('jokerRevealed', {
                                indicator: initialState.indicator,
                                okeyTile: initialState.okeyTile
                            });
                        }
                    }, 3000);

                } catch (e: any) {
                    console.error(`[startGame] Error:`, e);
                    this.io.to(room.id).emit('error', 'Failed to start game: ' + e.message);
                }
            }, 3000);
        });

        socket.on('restartVote', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            room.restartVotes.add(socket.id);
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

            // Check if all players in room voted (at least 2 for start)
            if (room.restartVotes.size === room.players.length && room.players.length >= 2) {
                // Trigger auto restart
                delete room.game;

                // Emit update indicating game is gone
                this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                this.io.to(room.id).emit('systemMessage', 'Everyone is ready! Restarting game...');

                const hostSocketId = room.players[0].id;
                const hostSocket = this.io.sockets.sockets.get(hostSocketId);
                if (hostSocket) {
                    hostSocket.emit('autoTriggerStart');
                }
            }
        });

        socket.on('getGameState', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;

            const room = this.rooms.get(player.roomId);
            if (room && room.game) {
                socket.emit('gameState', room.game.getFullState());
            }
        });

        // Pass-through game actions
        socket.on('gameAction', (action: any) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;

            const room = this.rooms.get(player.roomId);
            if (room && room.game) {
                try {
                    room.game.handleAction(player.id, action);
                } catch (e: any) {
                    socket.emit('error', e.message);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            const player = this.players.get(socket.id);
            if (player && player.roomId) {
                const room = this.rooms.get(player.roomId);
                if (room) {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    if (room.players.length === 0) {
                        this.rooms.delete(player.roomId);
                    } else {
                        // If game is in progress, handle player leave (end game or bot?)
                        // For MVP: end game or just notify
                        this.io.to(room.id).emit('playerLeft', player.id);
                        this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

                        if (room.game) {
                            // Reset game if player leaves for MVP
                            delete room.game;
                            this.io.to(room.id).emit('gameReset', 'Player disconnected');
                        }
                    }
                }
            }
            this.players.delete(socket.id);
        });
    }

    private getRoomData(code: string) {
        const room = this.rooms.get(code);
        if (!room) return null;
        return {
            id: room.id,
            players: room.players.map(p => ({
                name: p.name,
                id: p.id,
                avatar: p.avatar,
                readyToRestart: room.restartVotes?.has(p.id) || false
            })),
            winScores: room.winScores ? Object.fromEntries(room.winScores) : {},
            restartCount: room.restartVotes?.size || 0,
            gameStarted: !!room.game
        };
    }
}
