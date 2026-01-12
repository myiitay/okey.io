import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './game/RoomManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for MVP
        methods: ["GET", "POST"]
    }
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
    roomManager.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
