import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let connectionState = 0; // Counter to trigger useEffect refetch on reconnect
let messageCallbacks: Set<(message: any) => void> = new Set();
let currentServerSubscription: { serverId: string; channelId: string } | null = null;
let joinListenerSetup = false; // Track if join-on-connect listener is set up

const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  if (window.location.hostname === 'localhost') return 'http://localhost:5000';
  return window.location.origin; 
};

export const getConnectionState = () => connectionState;

export const initSocket = (userId: string) => {
  // If socket is already connected, reuse it
  if (socket?.connected) {
    console.log('[initSocket] Socket already connected, reusing');
    return socket;
  }

  // If socket exists but disconnected, try to reconnect instead of destroying
  if (socket && !socket.connected) {
    console.log('[initSocket] Socket exists but disconnected, attempting reconnect');
    socket.connect();
    return socket;
  }

  // Only create new socket if one doesn't exist at all
  if (socket === null) {
    console.log('[initSocket] Creating new socket connection for userId:', userId);
    
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
      console.log('[Socket] Connected with ID:', socket?.id);
      connectionState++; // Increment to trigger useEffect refetch
      
      // If there's a pending channel subscription, join it
      if (currentServerSubscription && !joinListenerSetup) {
        const { serverId, channelId } = currentServerSubscription;
        console.log('[Socket] Joining channel:', serverId, channelId);
        socket?.emit('join-server-channel', { serverId, channelId });
        joinListenerSetup = true;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      joinListenerSetup = false; // Reset so we rejoin after reconnect
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      connectionState++; // Increment to trigger useEffect refetch
      
      // Rejoin the current channel subscription if one exists
      if (currentServerSubscription) {
        const { serverId, channelId } = currentServerSubscription;
        console.log('[Socket] Rejoining channel after reconnect:', serverId, channelId);
        socket?.emit('join-server-channel', { serverId, channelId });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    // Global socket listener for messages - this persists across component mounts/unmounts
    socket.on('receive-message', (message: any) => {
      console.log('[Socket] Received message event, notifying', messageCallbacks.size, 'callbacks');
      // Notify all registered callbacks
      messageCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (err) {
          console.error('[Socket] Error in message callback:', err);
        }
      });
    });
  }

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
  console.log('[joinDMRoom] Attempting to join DM with recipient:', recipientId, 'Socket connected:', socket?.connected);
  if (socket?.connected) {
    socket.emit('join-dm', recipientId);
    console.log('[joinDMRoom] Emitted join-dm event');
  } else {
    console.warn('[joinDMRoom] Socket not connected, cannot join DM');
  }
};

export const sendDMMessage = (recipientId: string, message: any) => {
  console.log('[sendDMMessage] Sending to recipient:', recipientId, 'Socket connected:', socket?.connected);
  if (socket?.connected) {
    socket.emit('send-dm', { recipientId, message });
    console.log('[sendDMMessage] Emitted send-dm event');
  } else {
    console.warn('[sendDMMessage] Socket not connected, cannot send DM');
  }
};

export const joinServerChannel = (serverId: string, channelId: string) => {
  console.log('[joinServerChannel] Joining channel:', serverId, channelId, 'Socket connected:', socket?.connected);
  // Track this as the current subscription so we can rejoin on reconnect
  currentServerSubscription = { serverId, channelId };
  
  if (!socket) {
    console.warn('[joinServerChannel] Socket is null');
    return;
  }
  
  // Emit the join - Socket.IO will buffer it if not connected
  socket.emit('join-server-channel', { serverId, channelId });
  console.log('[joinServerChannel] Emitted join-server-channel event');
};

export const leaveServerChannel = (serverId: string, channelId: string) => {
  console.log('[leaveServerChannel] Leaving channel:', serverId, channelId);
  // Clear subscription tracking
  if (currentServerSubscription?.serverId === serverId && currentServerSubscription?.channelId === channelId) {
    currentServerSubscription = null;
  }
  
  if (socket?.connected) {
    socket.emit('leave-server-channel', { serverId, channelId });
  }
};

export const onReceiveMessage = (callback: (message: any) => void) => {
  console.log('[onReceiveMessage] Registering callback, total callbacks now:', messageCallbacks.size + 1);
  messageCallbacks.add(callback);
};

export const offReceiveMessage = (callback: (message: any) => void) => {
  console.log('[offReceiveMessage] Unregistering callback, total callbacks before:', messageCallbacks.size);
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

export const onFriendRemoved = (callback: (data: any) => void) => {
  if (!socket) {
    return;
  }
  socket.on('friend-removed', callback);
};

export const offFriendRemoved = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-removed', callback);
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

// Server member join/leave handlers
export const onMemberJoinedServer = (callback: (data: any) => void) => {
  if (!socket) {
    return;
  }
  socket.on('member-joined-server', callback);
};

export const offMemberJoinedServer = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('member-joined-server', callback);
};

export const onMemberLeftServer = (callback: (data: any) => void) => {
  if (!socket) {
    return;
  }
  socket.on('member-left-server', callback);
};

export const offMemberLeftServer = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('member-left-server', callback);
};
