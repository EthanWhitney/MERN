import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:5000' : window.location.origin;
};

export const initSocket = (userId: string) => {
  if (socket?.connected) {
    return socket;
  }

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
  });

  socket.on('disconnect', () => {
  });

  socket.on('connect_error', (_error) => {
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
    return;
  }
  socket.on('friend-request-received', callback);
};

export const offFriendRequestReceived = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-received', callback);
};

export const onFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onFriendRequestAccepted');
    return;
  }
  socket.on('friend-request-accepted', callback);
};

export const offFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-accepted', callback);
};

export const onFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onFriendRequestDeclined');
    return;
  }
  socket.on('friend-request-declined', callback);
};

export const offFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-declined', callback);
};

// User online/offline handlers
export const onUserOnline = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onUserOnline');
    return;
  }
  socket.on('user-online', callback);
};

export const offUserOnline = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('user-online', callback);
};

export const onUserOffline = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized when registering onUserOffline');
    return;
  }
  socket.on('user-offline', callback);
};

export const offUserOffline = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('user-offline', callback);
};
