"use client";

import { io, Socket } from "socket.io-client";

// Prevent multiple connections in dev mode
let socket: Socket;

export const getSocket = () => {
    if (!socket) {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
        socket = io(socketUrl, {
            autoConnect: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socket;
};
