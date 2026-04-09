// src/services/socketService.ts
// Single Socket.IO client shared across the entire app.
// Used by useFriendsChat (DM / friend events) and useServerMembers (presence).

import { io, type Socket } from 'socket.io-client';

const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

// ── Core singleton ────────────────────────────────────────────────────────────

/**
 * Creates (or returns the existing) socket connection authenticated as userId.
 * Safe to call multiple times — reconnects only when needed.
 */
export const initSocket = (userId: string): Socket => {
  if (socket && socket.connected) return socket;

  // If there's a stale socket, disconnect it cleanly before creating a new one
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { userId },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[socketService] connected:', socket?.id, 'as userId:', userId);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socketService] disconnected:', reason);
  });

  return socket;
};

/**
 * Returns the current socket instance (creates an unauthenticated one if none
 * exists — prefer calling initSocket(userId) first on login).
 */
export const getSocket = (): Socket => {
  if (socket) return socket;

  // Fallback: try to read userId from localStorage
  const userId = (() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      return JSON.parse(raw)?.id || '';
    } catch {
      return '';
    }
  })();

  return initSocket(userId);
};

/** Tears down the socket — call on logout. */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// ── DM helpers ────────────────────────────────────────────────────────────────

export const joinDMRoom = (recipientId: string): void => {
  getSocket().emit('join-dm', recipientId);
};

export const sendDMMessage = (recipientId: string, message: any): void => {
  getSocket().emit('send-dm', { recipientId, message });
};

export const onReceiveMessage = (handler: (message: any) => void): void => {
  getSocket().on('receive-message', handler);
};

export const offReceiveMessage = (handler: (message: any) => void): void => {
  getSocket().off('receive-message', handler);
};

// ── Friend-request event helpers ──────────────────────────────────────────────

export const onFriendRequestReceived = (handler: (data: any) => void): void => {
  getSocket().on('friend-request-received', handler);
};

export const offFriendRequestReceived = (handler: (data: any) => void): void => {
  getSocket().off('friend-request-received', handler);
};

export const onFriendRequestAccepted = (handler: (data: any) => void): void => {
  getSocket().on('friend-request-accepted', handler);
};

export const offFriendRequestAccepted = (handler: (data: any) => void): void => {
  getSocket().off('friend-request-accepted', handler);
};

export const onFriendRequestDeclined = (handler: (data: any) => void): void => {
  getSocket().on('friend-request-declined', handler);
};

export const offFriendRequestDeclined = (handler: (data: any) => void): void => {
  getSocket().off('friend-request-declined', handler);
};
