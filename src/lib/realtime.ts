import type { WebSocket, WebSocketServer } from "ws";

// Survives Next.js dev hot-reload the same way the Mongoose connection cache does.
const globalForWs = global as unknown as {
  wss?: WebSocketServer;
  wsRooms?: Map<string, Set<WebSocket>>;
};

export function getRooms(): Map<string, Set<WebSocket>> {
  if (!globalForWs.wsRooms) {
    globalForWs.wsRooms = new Map();
  }
  return globalForWs.wsRooms;
}

export function setWss(wss: WebSocketServer) {
  globalForWs.wss = wss;
}

export function joinRoom(barberId: string, socket: WebSocket) {
  const rooms = getRooms();
  if (!rooms.has(barberId)) rooms.set(barberId, new Set());
  rooms.get(barberId)!.add(socket);
}

export function leaveRoom(barberId: string, socket: WebSocket) {
  const rooms = getRooms();
  rooms.get(barberId)?.delete(socket);
  if (rooms.get(barberId)?.size === 0) rooms.delete(barberId);
}

/**
 * Notify every connected dashboard tab for this barber that their data
 * changed, so the client re-fetches instead of polling on a timer.
 */
export function notifyBarber(barberId: string, type: string) {
  const sockets = getRooms().get(barberId);
  if (!sockets) return;
  const payload = JSON.stringify({ type });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}
