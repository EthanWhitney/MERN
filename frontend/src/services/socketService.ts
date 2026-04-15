import { io, Socket } from 'socket.io-client';
import registry from './listenerRegistry';
import offlineQueue from './offlineQueue';
import listenerVerification from './listenerVerification';

let socket: Socket | null = null;
let connectionState = 0; // Counter to trigger useEffect refetch on reconnect
let messageCallbacks: Set<(message: any) => void> = new Set();
let currentServerSubscription: { serverId: string; channelId: string } | null = null;
let messageListenerHandler: ((message: any) => void) | null = null;

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

    // ========== PHASE 2: Integrate Listener Registry ==========
    // Set socket in registry - this will handle member presence listener reattachment
    registry.setSocket(socket);

    // ========== PHASE 3.1: Integrate Offline Queue ==========
    // Set socket in offline queue - this will handle flushing pending events
    offlineQueue.setSocket(socket);

    socket.on('connect', () => {
      console.log('[Socket] Connected with ID:', socket?.id);
      connectionState++; // Increment to trigger useEffect refetch
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    // Attach global message listener (not in registry - manages its own callbacks)
    const attachMessageListener = () => {
      // Remove old listener if one exists
      if (messageListenerHandler && socket) {
        socket.off('receive-message', messageListenerHandler);
      }

      // Create new handler
      messageListenerHandler = (message: any) => {
        console.log('[Socket] Received message event, notifying', messageCallbacks.size, 'callbacks');
        // Notify all registered callbacks
        messageCallbacks.forEach(callback => {
          try {
            callback(message);
          } catch (err) {
            console.error('[Socket] Error in message callback:', err);
          }
        });
      };

      socket?.on('receive-message', messageListenerHandler);
    };

    attachMessageListener();

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      connectionState++; // Increment to trigger useEffect refetch
      
      // ========== PHASE 2: Registry Handles Member Listener Reattachment ==========
      // Registry automatically reattaches member presence listeners
      // Just reattach the message listener and rejoin channel
      
      // Reattach message listener after reconnect
      attachMessageListener();
      
      // Rejoin the current channel subscription if one exists
      if (currentServerSubscription) {
        const { serverId, channelId } = currentServerSubscription;
        console.log('[Socket] Rejoining channel after reconnect:', serverId, channelId);
        socket?.emit('join-server-channel', { serverId, channelId });
      }
      
      // ========== PHASE 3.2: Verify Listeners After Reconnect ==========
      // Check that all critical listeners are properly attached
      setTimeout(() => {
        const verificationResult = listenerVerification.verify();
        if (verificationResult.issues.length > 0) {
          console.warn('[Socket] Listener verification found issues after reconnect:', verificationResult.issues);
        } else {
          console.log('[Socket] Listener verification passed after reconnect');
        }
      }, 100); // Small delay to ensure listeners had time to reattach
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    // ========== PHASE 1.2: Frontend Heartbeat (Detect Dead Connections) ==========
    // Respond to ping requests from backend
    socket.on('ping', () => {
      console.log('[Heartbeat] Received ping from backend, sending pong');
      socket?.emit('pong');
    });

    // Start client-side heartbeat: emit ping every 25s, expect pong within 10s
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let lastPongTime = Date.now();
    
    const startHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      
      heartbeatInterval = setInterval(() => {
        if (!socket?.connected) {
          console.log('[Heartbeat] Socket not connected, skipping heartbeat');
          return;
        }
        
        const timeSinceLastPong = Date.now() - lastPongTime;
        
        if (timeSinceLastPong > 35000) { // No pong in 35 seconds (25s interval + 10s timeout)
          console.error('[Heartbeat] No pong received in 35s - connection appears dead, forcing reconnect');
          socket?.disconnect();
          socket?.connect();
          lastPongTime = Date.now();
          return;
        }
        
        console.log('[Heartbeat] Emitting ping to backend');
        socket?.emit('ping');
      }, 25000); // Every 25 seconds
    };
    
    socket.on('pong', () => {
      console.log('[Heartbeat] Received pong from backend');
      lastPongTime = Date.now();
    });

    // Start heartbeat on connect
    socket.on('connect', () => {
      startHeartbeat();
    });

    socket.on('disconnect', () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    });
  }

  return socket;
};

/**
 * Wait for socket to be connected. Useful for hooks and components
 * that need to attach listeners only after socket is ready.
 * Timeout after 5 seconds to prevent infinite hanging.
 */
export const waitForSocketConnection = (timeoutMs = 5000): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    
    if (!s) {
      reject(new Error('Socket not initialized'));
      return;
    }

    if (s.connected) {
      resolve(s);
      return;
    }

    const timeout = setTimeout(() => {
      s.off('connect', onConnect);
      reject(new Error('Socket connection timeout'));
    }, timeoutMs);

    const onConnect = () => {
      clearTimeout(timeout);
      s.off('connect', onConnect);
      resolve(s);
    };

    s.on('connect', onConnect);
  });
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  
  // ========== PHASE 2: Notify Registry of Disconnect ==========
  registry.setSocket(null);
  
  // ========== PHASE 3.1: Notify Offline Queue of Disconnect ==========
  offlineQueue.setSocket(null);
  
  messageCallbacks.clear();
  currentServerSubscription = null;
  messageListenerHandler = null;
};

export const resetSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  
  // ========== PHASE 2: Notify Registry of Reset ==========
  registry.setSocket(null);
  
  // ========== PHASE 3.1: Notify Offline Queue of Reset ==========
  offlineQueue.setSocket(null);
  
  messageCallbacks.clear();
  currentServerSubscription = null;
  messageListenerHandler = null;
};

export const joinDMRoom = (recipientId: string) => {
  console.log('[joinDMRoom] Attempting to join DM with recipient:', recipientId, 'Socket connected:', socket?.connected);
  
  // Use offline queue to handle disconnections gracefully
  offlineQueue.queueEvent('join-dm', recipientId);
};

export const sendDMMessage = (recipientId: string, message: any) => {
  console.log('[sendDMMessage] Sending to recipient:', recipientId, 'Socket connected:', socket?.connected);
  
  // ========== PHASE 3.1: Use Offline Queue for Messages ==========
  // Queue the message - it will be sent immediately if socket connected, 
  // or persisted to localStorage if disconnected
  offlineQueue.queueEvent('send-dm', { recipientId, message });
};

export const joinServerChannel = (serverId: string, channelId: string) => {
  console.log('[joinServerChannel] Joining channel:', serverId, channelId, 'Socket connected:', socket?.connected);
  // Track this as the current subscription so we can rejoin on reconnect
  currentServerSubscription = { serverId, channelId };
  
  // Use offline queue to handle disconnections
  offlineQueue.queueEvent('join-server-channel', { serverId, channelId });
};

export const leaveServerChannel = (serverId: string, channelId: string) => {
  console.log('[leaveServerChannel] Leaving channel:', serverId, channelId);
  // Clear subscription tracking
  if (currentServerSubscription?.serverId === serverId && currentServerSubscription?.channelId === channelId) {
    currentServerSubscription = null;
  }
  
  // Use offline queue
  offlineQueue.queueEvent('leave-server-channel', { serverId, channelId });
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
    console.warn('[onFriendRequestReceived] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onFriendRequestReceived] Socket not connected, listener may not work');
  }
  socket.on('friend-request-received', callback);
};

export const offFriendRequestReceived = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-received', callback);
};

export const onFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[onFriendRequestAccepted] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onFriendRequestAccepted] Socket not connected, listener may not work');
  }
  socket.on('friend-request-accepted', callback);
};

export const offFriendRequestAccepted = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-accepted', callback);
};

export const onFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[onFriendRequestDeclined] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onFriendRequestDeclined] Socket not connected, listener may not work');
  }
  socket.on('friend-request-declined', callback);
};

export const offFriendRequestDeclined = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('friend-request-declined', callback);
};

export const onFriendRemoved = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[onFriendRemoved] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onFriendRemoved] Socket not connected, listener may not work');
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
    console.warn('[onUserOnline] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onUserOnline] Socket not connected, listener may not work');
  }
  socket.on('user-online', callback);
};

export const offUserOnline = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('user-online', callback);
};

export const onUserOffline = (callback: (data: any) => void) => {
  if (!socket) {
    console.warn('[onUserOffline] Socket not initialized');
    return;
  }
  if (!socket.connected) {
    console.warn('[onUserOffline] Socket not connected, listener may not work');
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

// ========== PHASE 5.1: PROFILE & ACCOUNT CHANGE EVENTS ==========

export const onProfilePictureChanged = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.on('profile-picture-changed', callback);
};

export const offProfilePictureChanged = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('profile-picture-changed', callback);
};

export const onServerProfileUpdated = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.on('server-profile-updated', callback);
};

export const offServerProfileUpdated = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('server-profile-updated', callback);
};

export const onMemberVoiceStateChanged = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.on('member-voice-state-changed', callback);
};

export const offMemberVoiceStateChanged = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('member-voice-state-changed', callback);
};

export const onUserAccountDeleted = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.on('user-account-deleted', callback);
};

export const offUserAccountDeleted = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off('user-account-deleted', callback);
};
