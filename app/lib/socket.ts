// lib/socket.ts
// -------------------------------------------------------
// Zentrale Socket.io-Verbindung für Ayozia App (Frontend)
// -------------------------------------------------------
import { io, Socket } from "socket.io-client";

const API = "http://192.168.0.224:5000";

// Singleton-Instanz
let socket: Socket | null = null;

function createSocket(): Socket {
  const s = io(API, {
    transports: ["websocket"], // wichtig für React Native
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  // Nur für Debug / Kontrolle
  s.on("connect", () => {
    console.log("✅ Socket connected:", s.id);
  });

  s.on("disconnect", (reason) => {
    console.log("⚠️ Socket disconnected:", reason);
  });

  s.on("connect_error", (err) => {
    console.log("❌ Socket connect_error:", err.message);
  });

  // Live-Track-Updates vom Server
  s.on("track:update", (payload) => {
    console.log("🎵 track:update", payload);
    // Beispiel payload:
    // {
    //   trackId: "abc123",
    //   plays: 10,
    //   likes: 5,
    //   saves: 2
    // }
    //
    // Hier kannst du später dein globales State-Management updaten
    // (z.B. Zustand in Context, Zustand in Zustand-Store usw.)
  });

  return s;
}

/**
 * Hole immer dieselbe Socket-Instanz.
 * In der ganzen App verwenden:
 *   import socket, { getSocket } from "../lib/socket";
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = createSocket();
  }
  return socket;
}

// Default-Export, falls du direkt importieren willst:
//   import socket from "../lib/socket";
const defaultSocket = getSocket();
export default defaultSocket;
