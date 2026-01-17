import { Server, Socket } from 'socket.io';
import { OkeyGame } from './OkeyGame';
import { Game101 } from './Game101';
import { GameState, RoomSettings, Player as SharedPlayer, RoomData, CreateRoomSchema, JoinRoomSchema, GameState101 } from '@okey/shared';
import { randomUUID } from 'crypto';

interface Player extends SharedPlayer {
    reconnectTimer?: NodeJS.Timeout;
}

interface Room {
    id: string;
    players: Player[];
    game?: OkeyGame | Game101;
    maxPlayers: number;
    winScores: Map<string, number>; // Name -> Score
    restartVotes: Set<string>; // Socket ID
    gameMode?: '101' | 'standard'; // Game mode
    spectators: Player[];
    settings: RoomSettings;
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    // Map socket.id -> Player (for quick lookup of active connection)
    private players: Map<string, Player> = new Map();
    // Map token -> Player (for reconnection lookup)
    private sessions: Map<string, Player> = new Map();

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

        // 1. REJOIN ATTEMPT (Client sends token)
        socket.on('rejoinGame', (token: string) => {
            console.log(`[rejoinGame] Attempt with token: ${token}`);
            const session = this.sessions.get(token);

            if (session && session.roomId) {
                const room = this.rooms.get(session.roomId);
                if (room) {
                    console.log(`[rejoinGame] Success: ${session.name} rejoining room ${room.id}`);

                    // Cancel disconnect timer if exists
                    if (session.reconnectTimer) {
                        clearTimeout(session.reconnectTimer);
                        session.reconnectTimer = undefined;
                    }

                    // Update mappings
                    this.players.set(socket.id, session); // Map new socket to existing session

                    const oldId = session.id;
                    session.id = socket.id; // Update to new socket ID
                    session.connected = true;
                    session.disconnectTime = undefined;

                    // Update game instance if exists
                    if (room.game) {
                        room.game.updatePlayerId(oldId, socket.id);
                    }

                    // Join socket room
                    socket.join(room.id);

                    // Notify self
                    socket.emit('rejoinSuccess', {
                        roomCode: room.id,
                        state: room.game ? this.sanitizeGameState(room.game.getFullState(), session.id) : null
                    });

                    // Notify room
                    this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

                    const joinMsg = {
                        sender: 'Sistem',
                        text: `${session.name} tekrar bağlandı.`,
                        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                        isSystem: true
                    };
                    this.io.to(room.id).emit('chatMessage', joinMsg);

                    return;
                }
            }

            // If invalid or expired
            socket.emit('error', 'Session expired or invalid.');
            socket.emit('forceRedirect', '/');
        });

        socket.on('createRoom', (payload: any) => {
            let rawData = payload;
            if (typeof payload === 'string') {
                rawData = { name: payload };
            }

            const result = CreateRoomSchema.safeParse(rawData);
            if (!result.success) {
                socket.emit('error', result.error.issues[0].message);
                return;
            }

            const { name, avatar: rawAvatar, frameId: rawFrameId, gameMode: rawGameMode } = result.data;
            const avatar = rawAvatar || "👤";
            const frameId = rawFrameId || "none";
            const gameMode = rawGameMode || 'standard';

            // --- LEAK PREVENTION: Remove from old room if any ---
            const existingPlayer = this.players.get(socket.id);
            if (existingPlayer && existingPlayer.roomId) {
                const oldRoom = this.rooms.get(existingPlayer.roomId);
                if (oldRoom) {
                    this.removePlayerFromRoom(existingPlayer, oldRoom, 'left');
                }
            }

            // Create new Session
            const token = randomUUID();
            const newPlayer: Player = {
                id: socket.id,
                token,
                name,
                avatar,
                frameId,
                connected: true,
                isReady: true // Host is always ready
            };

            this.sessions.set(token, newPlayer);
            this.players.set(socket.id, newPlayer);

            const code = this.generateRoomCode();
            const room: Room = {
                id: code,
                players: [newPlayer],
                maxPlayers: 4,
                winScores: new Map(),
                restartVotes: new Set(),
                gameMode: gameMode,
                spectators: [],
                settings: {
                    turnTime: 30,
                    targetScore: 3,
                    isPublic: true,
                    isPaired: false
                }
            };

            this.rooms.set(code, room);
            newPlayer.roomId = code;

            socket.join(code);
            // Send token back to client for storage
            socket.emit('sessionCreated', token);
            socket.emit('roomCreated', code);
            this.io.to(code).emit('updateRoom', this.getRoomData(code));
            this.broadcastRoomList();
        });

        socket.on('checkRoom', (code: string) => {
            const room = this.rooms.get(code);
            if (room) {
                socket.emit('updateRoom', this.getRoomData(code));
            } else {
                socket.emit('error', 'Oda bulunamadı');
            }
        });

        socket.on('getRooms', () => {
            this.handleGetRooms(socket);
        });


        socket.on('joinRoom', (payload: any) => {
            const result = JoinRoomSchema.safeParse(payload);
            if (!result.success) {
                socket.emit('error', result.error.issues[0].message);
                return;
            }
            const { code, name, avatar, frameId } = result.data;
            const room = this.rooms.get(code);

            if (!room) {
                socket.emit('error', 'Oda bulunamadı');
                return;
            }

            if (room.players.length >= room.maxPlayers) {
                // Join as Spectator
                const spectator: Player = {
                    id: socket.id,
                    token: randomUUID(),
                    name: name + (socket.handshake.query.lang === 'en' ? " (Spectator)" : " (İzleyici)"),
                    avatar: avatar || "👤",
                    frameId: frameId,
                    connected: true,
                    roomId: code
                };
                room.spectators.push(spectator);
                this.players.set(socket.id, spectator);
                socket.join(code);
                socket.emit('joinedRoom', code);
                socket.emit('isSpectator', true);
                this.io.to(code).emit('updateRoom', this.getRoomData(code));
                return;
            }

            if (room.game) {
                socket.emit('error', 'Oyun zaten başladı');
                return;
            }

            // --- LEAK PREVENTION: Remove from old room if any ---
            const existingPlayer = this.players.get(socket.id);
            if (existingPlayer && existingPlayer.roomId) {
                const oldRoom = this.rooms.get(existingPlayer.roomId);
                if (oldRoom) {
                    this.removePlayerFromRoom(existingPlayer, oldRoom, 'left');
                }
            }

            // Create new Session
            const token = randomUUID();
            const newPlayer: Player = {
                id: socket.id,
                token,
                name,
                avatar: avatar || "👤",
                frameId,
                connected: true,
                roomId: code
            };

            this.sessions.set(token, newPlayer);
            this.players.set(socket.id, newPlayer);

            newPlayer.isReady = false;
            room.players.push(newPlayer);
            socket.join(code);

            socket.emit('sessionCreated', token);
            socket.emit('joinedRoom', code);
            this.io.to(code).emit('updateRoom', this.getRoomData(code));
            this.broadcastRoomList();
        });

        socket.on('addBot', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            // Only host can add bots (Host is index 0)
            if (room.players[0].token !== player.token) {
                socket.emit('error', 'Sadece kurucu bot ekleyebilir.');
                return;
            }

            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', 'Oda dolu');
                return;
            }

            const botId = `bot_${randomUUID()}`;
            const botAvatars = ["👨🏻‍🌾", "👴🏻", "👨🏻", "🧔🏻", "👳🏻‍♂️", "👨🏽‍🌾", "👴🏽", "👨🏽", "👳🏽‍♂️"];
            const botNames = [
                "İdris Amca", "Hamit Dayı", "Abdullah Efendi", "Abidin Başgan",
                "Yakup Emmi", "Osman Ağa", "Recep Dayı", "Şaban Emmi",
                "Ramazan Usta", "Bekir Ortak", "Cemal Dayı", "Dursun Abi"
            ];

            const botPlayer: Player = {
                id: botId,
                token: botId,
                name: botNames[Math.floor(Math.random() * botNames.length)],
                avatar: botAvatars[Math.floor(Math.random() * botAvatars.length)],
                connected: true,
                roomId: room.id,
                isBot: true,
                isReady: true // Bots are always ready
            };

            room.players.push(botPlayer);
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            this.broadcastRoomList();

            const msg = {
                sender: 'Sistem',
                text: `${botPlayer.name} odaya katıldı.`,
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: true
            };
            this.io.to(room.id).emit('chatMessage', msg);
        });

        // KICK PLAYER
        socket.on('kickPlayer', (targetId: string) => { // targetId is socket.id of target
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            // Only host can kick (Host is index 0)
            if (room.players[0].token !== player.token) {
                socket.emit('error', 'Sadece kurucu oyuncu atabilir.');
                return;
            }
            if (targetId === player.id) return;

            // Find target by socket ID (targetId)
            const target = room.players.find(p => p.id === targetId);

            if (target) {
                this.removePlayerFromRoom(target, room, 'kicked');
            }
        });

        socket.on('startGame', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;

            const room = this.rooms.get(player.roomId);
            if (!room) return;

            if (room.players[0].token !== player.token) {
                socket.emit('error', 'Sadece kurucu oyunu başlatabilir');
                return;
            }

            if (room.players.length !== 2 && room.players.length !== 4) {
                socket.emit('error', 'Oyun için tam olarak 2 veya 4 oyuncu gerekiyor');
                return;
            }

            // Check if all players (inclusive) are ready
            // Bots are always ready. Host (index 0) is always ready since they click start.
            const allReady = room.players.every((p, idx) => idx === 0 || p.isReady || p.isBot);
            if (!allReady) {
                socket.emit('error', 'Başlamak için herkesin hazır olması gerekiyor!');
                return;
            }

            if (room.game) {
                socket.emit('error', 'Oyun zaten başladı');
                return;
            }

            // Start Game Immediately
            if (!this.rooms.has(room.id) || room.players.length < 1) return;
            this.startRoomGame(room);
        });

        socket.on('restartVote', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            room.restartVotes.add(socket.id);
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

            this.checkRestartCondition(room);
        });

        socket.on('getGameState', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return; // Should we try token lookup? 'rejoinGame' handles that.

            const room = this.rooms.get(player.roomId);
            if (room && room.game) {
                const fullState = room.game.getFullState();
                const sanitized = this.sanitizeGameState(fullState, player.id);
                socket.emit('gameState', sanitized);
            }
        });

        socket.on('sendMessage', (msg: string) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            const chatPayload = {
                sender: player.name,
                avatar: player.avatar || "👤",
                text: msg,
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: false
            };
            this.io.to(room.id).emit('chatMessage', chatPayload);
        });

        socket.on('gameAction', async (action: any) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;

            const room = this.rooms.get(player.roomId);
            if (room && room.game) {
                try {
                    await room.game.handleAction(player.id, action);
                } catch (e: any) {
                    socket.emit('error', e.message);
                }
            }
        });

        // --- NEW FEATURES ---

        socket.on('toggleReady', () => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room || room.game) return;

            player.isReady = !player.isReady;
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
        });

        socket.on('updateSettings', (newSettings: Partial<RoomSettings>) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room || room.game) return;

            // Only host can update settings
            if (room.players[0].id !== player.id) {
                socket.emit('error', 'Sadece kurucu ayarları güncelleyebilir');
                return;
            }

            room.settings = { ...room.settings, ...newSettings };
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            this.broadcastRoomList();
        });

        socket.on('sendEmote', (emote: string) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room) return;

            this.io.to(room.id).emit('emoteReceived', {
                playerId: player.id,
                emote: emote
            });
        });

        socket.on('joinTeam', (team: 1 | 2) => {
            const player = this.players.get(socket.id);
            if (!player || !player.roomId) return;
            const room = this.rooms.get(player.roomId);
            if (!room || room.game) return;

            player.team = team;
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            const player = this.players.get(socket.id);

            if (player && player.roomId) {
                const room = this.rooms.get(player.roomId);
                if (room) {
                    player.connected = false;
                    player.disconnectTime = Date.now();

                    // Notify room
                    this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

                    const leftMsg = {
                        sender: 'Sistem',
                        text: `${player.name} bağlantısı koptu. (Bekleniyor...)`,
                        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                        isSystem: true
                    };
                    this.io.to(room.id).emit('chatMessage', leftMsg);

                    // Set Auto-Kick Timer (60 seconds)
                    player.reconnectTimer = setTimeout(() => {
                        // Double check if still disconnected
                        if (!player.connected) {
                            console.log(`Player ${player.name} timed out. Removing from room ${room.id}`);
                            this.removePlayerFromRoom(player, room, 'timeout');
                        }
                    }, 60000);
                }
            }
            // Remove from active socket map only
            this.players.delete(socket.id);
            // DO NOT delete from 'sessions' yet
        });
    }

    public handleGetRooms(socket: Socket) {
        socket.emit('roomListUpdate', this.getPublicRooms());
    }

    private removePlayerFromRoom(player: Player, room: Room, reason: string = 'left') {
        // Clear session
        this.sessions.delete(player.token);
        if (player.reconnectTimer) clearTimeout(player.reconnectTimer);

        room.players = room.players.filter(p => p.token !== player.token); // Filter by token to be safe

        if (reason === 'kicked') {
            this.io.to(player.id).emit('kicked', 'Odan atıldınız.');
            const s = this.io.sockets.sockets.get(player.id);
            if (s) s.leave(room.id);
        } else if (reason === 'banned') {
            this.io.to(player.id).emit('banned', 'Odan yasaklandınız.');
            const s = this.io.sockets.sockets.get(player.id);
            if (s) s.leave(room.id);
        }

        // Check if any REAL players are left
        const realPlayersCount = room.players.filter(p => !p.isBot).length;

        if (realPlayersCount === 0) {
            console.log(`[RoomManager] Room ${room.id} has no real players left. Destroying.`);

            // Cleanup: Remove bots from player map
            room.players.forEach(p => {
                if (p.isBot) {
                    this.players.delete(p.id);
                    // Sessions? Bots don't have sessions usually or share ID as token.
                    this.sessions.delete(p.token);
                }
            });

            this.rooms.delete(room.id);
            this.broadcastRoomList();
        } else {
            const msgText = reason === 'timeout'
                ? `${player.name} tekrar bağlanamadı ve oyundan düştü.`
                : `${player.name} oyundan ayrıldı.`;

            const msg = {
                sender: 'Sistem',
                text: msgText,
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: true
            };
            this.io.to(room.id).emit('chatMessage', msg);
            this.io.to(room.id).emit('playerLeft', player.id);
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            if (room.game) {
                // If game is active and player drops, we must handle it.
                // For now, reset game.
                delete room.game;
                this.io.to(room.id).emit('gameReset', `${player.name} düştüğü için oyun bitti.`);
            }
            this.broadcastRoomList();
        }
    }

    public getPublicRooms() {
        // Return active rooms that are not full or playing
        const publicRooms: any[] = [];
        this.rooms.forEach(room => {
            if (room.players.length > 0) {
                publicRooms.push({
                    id: room.id,
                    count: room.players.length,
                    max: room.maxPlayers,
                    status: room.game ? 'Playing' : 'Waiting',
                    mode: room.gameMode || 'standard'
                });
            }
        });
        return publicRooms;
    }

    private broadcastRoomList() {
        this.io.emit('roomListUpdate', this.getPublicRooms());
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
                frameId: p.frameId,
                readyToRestart: room.restartVotes?.has(p.id) || false,
                connected: p.connected, // Send connection status
                isReady: p.isReady,
                isBot: p.isBot,
                team: p.team
            })),
            winScores: room.winScores ? Object.fromEntries(room.winScores) : {},
            restartCount: room.restartVotes?.size || 0,
            gameStarted: !!room.game,
            gameMode: room.gameMode || 'standard',
            settings: room.settings
        };
    }

    private sanitizeGameState(state: GameState | GameState101, targetPlayerId: string): GameState | GameState101 {
        // Optimization: Shallow copy root, reconstruct players array.
        // Avoid JSON.parse/stringify for better performance.
        const sanitizedParams: any = {
            ...state, // Shallow copy primitives
            players: state.players.map((p: any) => {
                if (p.id !== targetPlayerId && targetPlayerId !== "SPECTATOR") { // Spectator sees hidden
                    // NOTE: "SPECTATOR" should theoretically see everything if we want? 
                    // But usually spectators shouldn't see hands either to prevent cheating via dual screen.
                    // Current logic: p.id !== targetPlayerId hides hand.
                    // If targetPlayerId is "SPECTATOR", it is !== p.id (which is socket ID).
                    // So Spectators see HIDDEN hands. Correct.
                    return {
                        ...p,
                        hand: [] // Hide hand
                    };
                }
                // If it IS the player, return full object (or shallow copy if we mutate later, but we don't)
                return p;
            })
        }
        return sanitizedParams;
    }

    private broadcastGameState(roomId: string, state: GameState | GameState101, eventName: string = 'gameState') {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players.forEach(player => {
            if (player.connected) {
                const sanitized = this.sanitizeGameState(state, player.id);
                this.io.to(player.id).emit(eventName, sanitized);
            }
        });

        // Broadcast to Spectators (Hide all hands)
        room.spectators.forEach(spectator => {
            if (spectator.connected) {
                const sanitized = this.sanitizeGameState(state, "SPECTATOR"); // Non-existent ID hides all
                this.io.to(spectator.id).emit(eventName, sanitized);
            }
        });

        // --- BOT / AFK LOGIC TRIGGER ---
        if (state.status === 'PLAYING') {
            const currentPlayerId = state.players[state.turnIndex].id;
            const roomPlayer = room.players.find(p => p.id === currentPlayerId);

            if (roomPlayer) {
                if (roomPlayer.isBot) {
                    this.triggerBotMove(roomId, currentPlayerId);
                } else if (!roomPlayer.connected) {
                    // Disconnected player takeover logic: 
                    // Wait a bit (grace period) then bot takes one turn
                    console.log(`[Takeover] Triggering bot takeover for disconnected player ${roomPlayer.name}`);
                    this.triggerBotMove(roomId, currentPlayerId, 10000); // 10s grace period
                }
            }
        }
    }

    private checkRestartCondition(room: Room) {
        if (room.restartVotes.size === room.players.length && room.players.length >= 2) {
            delete room.game;
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
            this.broadcastRoomList();

            // SYSTEM ANNOUNCEMENT
            const readyMsg = {
                sender: 'Sistem',
                text: 'Herkes hazır! Yeni oyun başlıyor...',
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: true
            };
            this.io.to(room.id).emit('chatMessage', readyMsg);

            // Reliable Start: Call internal method directly
            this.startRoomGame(room);
        }
    }

    private startRoomGame(room: Room) {
        if (!this.rooms.has(room.id) || room.players.length < 1) return;

        console.log(`Starting game in room ${room.id} (Internal Trigger)`);
        try {
            let playerOrder = room.players;

            if (room.settings.isPaired) {
                // For paired game, we need 4 players and they must have teams
                // We'll auto-assign teams if they are missing
                if (room.players.length !== 4) {
                    throw new Error("Eşli oyun için 4 oyuncu gereklidir.");
                }

                const team1 = room.players.filter(p => p.team === 1);
                const team2 = room.players.filter(p => p.team === 2);
                const undelared = room.players.filter(p => !p.team);

                // Auto balance teams if anyone hasn't chosen
                undelared.forEach(p => {
                    if (team1.length < 2) {
                        p.team = 1;
                        team1.push(p);
                    } else {
                        p.team = 2;
                        team2.push(p);
                    }
                });

                if (team1.length !== 2 || team2.length !== 2) {
                    throw new Error("Takımlar dengeli değil (2 vs 2 olmalı).");
                }

                // Arrange: Team1[0], Team2[0], Team1[1], Team2[1]
                playerOrder = [team1[0], team2[0], team1[1], team2[1]];
            }

            if (room.gameMode === '101') {
                room.game = new Game101(playerOrder.map(p => p.id), (gameState: GameState101) => {
                    // Win detection reuse
                    if (gameState.status === 'FINISHED' && gameState.winnerId) {
                        const winner = room.players.find(p => p.id === gameState.winnerId);
                        if (winner) {
                            if (room.settings.isPaired && winner.team) {
                                // Team win
                                const teamName = `Team ${winner.team}`;
                                const currentScore = room.winScores.get(teamName) || 0;
                                room.winScores.set(teamName, currentScore + 1);
                            } else {
                                // Individual win
                                const currentScore = room.winScores.get(winner.name) || 0;
                                room.winScores.set(winner.name, currentScore + 1);
                            }
                            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                        }
                    } else if (gameState.status === 'FINISHED' && !gameState.winnerId) {
                        // Draw logic
                        console.log(`[RoomManager] Game in room ${room.id} ended in a draw.`);
                        const drawMsg = {
                            sender: 'Sistem',
                            text: 'Oyun berabere bitti! Bütün taşlar tükendi.',
                            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                            isSystem: true
                        };
                        this.io.to(room.id).emit('chatMessage', drawMsg);
                    }
                    this.broadcastGameState(room.id, gameState);

                    if (gameState.status === 'FINISHED') {
                        room.players.forEach(p => {
                            if (p.isBot) {
                                room.restartVotes.add(p.id);
                            }
                        });
                        this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                        this.checkRestartCondition(room);
                    }
                });
            } else {
                room.game = new OkeyGame(playerOrder.map(p => p.id), (gameState: GameState) => {
                    // Win detection reuse
                    if (gameState.status === 'FINISHED' && gameState.winnerId) {
                        const winner = room.players.find(p => p.id === gameState.winnerId);
                        if (winner) {
                            if (room.settings.isPaired && winner.team) {
                                // Team win
                                const teamName = `Team ${winner.team}`;
                                const currentScore = room.winScores.get(teamName) || 0;
                                room.winScores.set(teamName, currentScore + 1);
                            } else {
                                // Individual win
                                const currentScore = room.winScores.get(winner.name) || 0;
                                room.winScores.set(winner.name, currentScore + 1);
                            }
                            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                        }
                    } else if (gameState.status === 'FINISHED' && !gameState.winnerId) {
                        // Draw logic
                        console.log(`[RoomManager] Game in room ${room.id} ended in a draw.`);
                        const drawMsg = {
                            sender: 'Sistem',
                            text: 'Oyun berabere bitti! Bütün taşlar tükendi.',
                            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                            isSystem: true
                        };
                        this.io.to(room.id).emit('chatMessage', drawMsg);
                    }
                    this.broadcastGameState(room.id, gameState);

                    if (gameState.status === 'FINISHED') {
                        room.players.forEach(p => {
                            if (p.isBot) {
                                room.restartVotes.add(p.id);
                            }
                        });
                        this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));
                        this.checkRestartCondition(room);
                    }
                });
            }

            const initialState = room.game.start();
            room.restartVotes.clear();

            this.broadcastGameState(room.id, initialState, 'gameStarted');
            this.io.to(room.id).emit('updateRoom', this.getRoomData(room.id));

        } catch (e: any) {
            console.error(`[startRoomGame] Error:`, e);
            this.io.to(room.id).emit('error', 'Failed to start game: ' + e.message);
        }
    }

    private async triggerBotMove(roomId: string, botId: string, delay: number = 2000) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;

        // Wait a bit for "thinking" or grace period
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            const state = room.game.getFullState();
            const botState = state.players.find(p => p.id === botId);
            if (!botState || !botState.isTurn) return;

            // 1. DRAW
            // Only draw if we have 14 tiles. If we have 15 (as starter), skip to discard.
            if (botState.hand.length === 14) {
                // For now, always draw from center
                await room.game.handleAction(botId, { type: 'DRAW_CENTER' });
                // Wait for "thinking" before discard
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // 2. DISCARD
            // Find a tile to discard - for now, just discard a random one
            // Higher value tiles are generally better to discard if they don't form a pair (very simple logic)
            const botHand = room.game.getFullState().players.find(p => p.id === botId)?.hand || [];
            if (botHand.length === 15) {
                // Find highest value tile that isn't okey
                const okeyTile = room.game.getFullState().okeyTile;
                const normalTiles = botHand.filter(t => t.color !== 'fake' && !(t.color === okeyTile.color && t.value === okeyTile.value));

                let discardTileId = botHand[0].id;
                if (normalTiles.length > 0) {
                    // Simple logic: highest value
                    normalTiles.sort((a, b) => b.value - a.value);
                    discardTileId = normalTiles[0].id;
                } else {
                    // Fallback to random
                    discardTileId = botHand[Math.floor(Math.random() * botHand.length)].id;
                }

                await room.game.handleAction(botId, { type: 'DISCARD', payload: { tileId: discardTileId } });
            }
        } catch (e) {
            console.error(`[Bot Error] roomId: ${roomId}, botId: ${botId}`, e);
        }
    }
}
