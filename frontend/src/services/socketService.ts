import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:5000' : window.location.origin;
};

export const initSocket = (userId: string) => {
  if (socket?.connected) return socket;

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
    console.log('✅ Socket.IO connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket.IO disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO error:', error);
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
