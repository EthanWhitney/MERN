import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let connectionState = 0; // Counter to trigger useEffect refetch on reconnect
let messageCallbacks: Set<(message: any) => void> = new Set();
let currentServerSubscription: { serverId: string; channelId: string } | null = null;
let joinListenerSetup = false; // Track if join-on-connect listener is set up

const getSocketUrl = () => {
  return '';
};

export const getConnectionState = () => connectionState;

export const initSocket = (userId: string) => {
  // If socket is already connected, reuse it
  if (socket?.connected) {
    return socket;
  }

  // Clean up any existing socket and create fresh one
  if (socket) {
    socket.close();
  }
  
  socket = null;
  messageCallbacks.clear();
  joinListenerSetup = false;

  // Create new socket connection
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
    connectionState++; // Increment to trigger useEffect refetch
    
    // If there's a pending channel subscription, join it
    if (currentServerSubscription && !joinListenerSetup) {
      const { serverId, channelId } = currentServerSubscription;
      socket?.emit('join-server-channel', { serverId, channelId });
      joinListenerSetup = true;
    }
  });

  socket.on('disconnect', () => {
    joinListenerSetup = false; // Reset so we rejoin after reconnect
  });

  socket.on('reconnect', () => {
    connectionState++; // Increment to trigger useEffect refetch
    
    // Rejoin the current channel subscription if one exists
    if (currentServerSubscription) {
      const { serverId, channelId } = currentServerSubscription;
      socket?.emit('join-server-channel', { serverId, channelId });
    }
  });

  socket.on('connect_error', (_error) => {
    // Connection error occurred
  });

  // Global socket listener for messages - this persists across component mounts/unmounts
  socket.on('receive-message', (message: any) => {
    // Notify all registered callbacks
    messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (err) {
        // Error in message callback
      }
    });
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    messageCallbacks.clear();
    currentServerSubscription = null;
  }
};

export const resetSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  messageCallbacks.clear();
  currentServerSubscription = null;
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

export const joinServerChannel = (serverId: string, channelId: string) => {
  // Track this as the current subscription so we can rejoin on reconnect
  currentServerSubscription = { serverId, channelId };
  
  if (!socket) {
    return;
  }
  
  // Emit the join - Socket.IO will buffer it if not connected
  socket.emit('join-server-channel', { serverId, channelId });
};

export const leaveServerChannel = (serverId: string, channelId: string) => {
  // Clear subscription tracking
  if (currentServerSubscription?.serverId === serverId && currentServerSubscription?.channelId === channelId) {
    currentServerSubscription = null;
  }
  
  if (socket?.connected) {
    socket.emit('leave-server-channel', { serverId, channelId });
  }
};

export const onReceiveMessage = (callback: (message: any) => void) => {
  messageCallbacks.add(callback);
};

export const offReceiveMessage = (callback: (message: any) => void) => {
  messageCallbacks.delete(callback);
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
    return;
  }
  socket.on('user-offline', callback);
};

export const offUserOffline = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('user-offline', callback);
};
