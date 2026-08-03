// Single shared socket.io-client connection to the backend's /realtime
// namespace. Handshake and event names mirror src/realtime/realtime.gateway.ts
// exactly: auth.token on connect, message:new / typing:update from the
// server, typing:start / typing:stop emitted by the client.

import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export type TypingUpdate = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/realtime`, {
    auth: { token: getAccessToken() },
    autoConnect: true,
    transports: ["websocket"],
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

// Call after a token refresh so a reconnect (e.g. after the access token
// expired mid-session) presents the new token in the handshake.
export function refreshSocketAuth() {
  if (!socket) return;
  socket.auth = { token: getAccessToken() };
  if (!socket.connected) socket.connect();
}

export function emitTypingStart(conversationId: string) {
  socket?.emit("typing:start", { conversationId });
}

export function emitTypingStop(conversationId: string) {
  socket?.emit("typing:stop", { conversationId });
}
