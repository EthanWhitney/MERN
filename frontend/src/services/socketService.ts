import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:5000' : window.location.origin;
};

export const initSocket = (userId: string) => {
  if (socket?.connected) {
    console.log('[socketService] Socket already connected, returning existing socket');
    return socket;
  }

  console.log('[socketService] Initializing Socket.IO with userId:', userId);
  socket = io(getSocketUrl(), {
    auth: {
      userId: userId
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('[socketService] ✅ Socket.IO connected, sid:', socket?.id);
    console.log('[socketService] Socket is now ready for listeners');
  });

  socket.on('disconnect', () => {
    console.log('[socketService] ❌ Socket.IO disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('[socketService] Socket.IO connection error:', error);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinDMRoom = (recipientId: string) => {
  if (socket?.connected) {
    socket.emit('join-dm', recipientId);
  }
};

export const sendDMMessage = (recipientId: string, message: any) => {
  if (socket?.connected) {
    socket.emit('send-dm', { recipientId, message });
  }
};

export const onReceiveMessage = (callback: (message: any) => void) => {
  if (socket) {
    socket.on('receive-message', callback);
  }
};

export const offReceiveMessage = (callback: (message: any) => void) => {
  if (socket) {
    socket.off('receive-message', callback);
  }
};

// Friend request handlers
export const onFriendRequestReceived = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onFriendRequestReceived');
    return;
  }
  console.log('[socketService] Registering onFriendRequestReceived listener');
  socket.on('friend-request-received', callback);
};

export const offFriendRequestReceived = (callback: (data: any) => void) => {
  if (!socket) return;
  console.log('[socketService] Unregistering onFriendRequestReceived listener');
  socket.off('friend-request-received', callback);
};

export const onFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onFriendRequestAccepted');
    return;
  }
  console.log('[socketService] Registering onFriendRequestAccepted listener');
  socket.on('friend-request-accepted', callback);
};

export const offFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) return;
  console.log('[socketService] Unregistering onFriendRequestAccepted listener');
  socket.off('friend-request-accepted', callback);
};

export const onFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onFriendRequestDeclined');
    return;
  }
  console.log('[socketService] Registering onFriendRequestDeclined listener');
  socket.on('friend-request-declined', callback);
};

export const offFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) return;
  console.log('[socketService] Unregistering onFriendRequestDeclined listener');
  socket.off('friend-request-declined', callback);
};
