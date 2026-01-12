"use client";

import { io, Socket } from "socket.io-client";

// Prevent multiple connections in dev mode
let socket: Socket;

export const getSocket = () => {
    if (!socket) {
        socket = io("http://localhost:3001", {
            transports: ["websocket"],
            autoConnect: true,
        });
    }
    return socket;
};
