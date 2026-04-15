import { Socket } from 'socket.io-client';

/**
 * PHASE 2: Centralized Listener Registry
 * 
 * Single source of truth for all socket.io event listeners.
 * Guarantees listeners are reattached atomically after reconnection.
 * 
 * Usage:
 *   Registry.on('event-name', (data) => { ... })
 *   Registry.off('event-name', handler)
 *   Registry.setSocket(socket) - call after socket creation
 */

type EventHandler = (data?: any) => void;

interface Listener {
  eventName: string;
  handler: EventHandler;
  attached: boolean;
}

class ListenerRegistry {
  private socket: Socket | null = null;
  private listeners: Listener[] = [];
  private reattachInProgress = false;

  /**
   * Set the socket instance for this registry
   * Should be called immediately after socket creation
   */
  setSocket(socket: Socket | null) {
    this.socket = socket;
    
    if (socket) {
      console.log('[ListenerRegistry] Socket attached');
      
      // Attach all pending listeners
      this.attachPendingListeners();
      
      // Re-attach all listeners on reconnection
      socket.on('reconnect', () => {
        console.log('[ListenerRegistry] Socket reconnected, reattaching listeners');
        this.reattachAllListeners();
      });
      
      // Mark all listeners as detached on disconnect
      socket.on('disconnect', () => {
        console.log('[ListenerRegistry] Socket disconnected, marking listeners as detached');
        this.markAllListenersDetached();
      });
    }
  }

  /**
   * Register a listener for an event
   * Automatically attaches to socket if socket is connected
   */
  on(eventName: string, handler: EventHandler): void {
    // Add to registry
    const listener: Listener = {
      eventName,
      handler,
      attached: false
    };
    
    this.listeners.push(listener);
    console.log(`[ListenerRegistry] Registered listener for '${eventName}' (total: ${this.listeners.length})`);
    
    // Attach immediately if socket is ready
    this.attachListener(listener);
  }

  /**
   * Unregister a listener for an event
   */
  off(eventName: string, handler: EventHandler): void {
    // Find and remove listener
    const index = this.listeners.findIndex(
      l => l.eventName === eventName && l.handler === handler
    );
    
    if (index !== -1) {
      const listener = this.listeners[index];
      
      // Detach from socket if attached
      if (listener.attached && this.socket) {
        this.socket.off(eventName, handler);
        console.log(`[ListenerRegistry] Detached listener from '${eventName}'`);
      }
      
      // Remove from registry
      this.listeners.splice(index, 1);
      console.log(`[ListenerRegistry] Unregistered listener for '${eventName}' (remaining: ${this.listeners.length})`);
    }
  }

  /**
   * Clear all listeners for an event
   */
  offAll(eventName: string): void {
    const toRemove = this.listeners.filter(l => l.eventName === eventName);
    
    toRemove.forEach(listener => {
      if (listener.attached && this.socket) {
        this.socket.off(eventName, listener.handler);
      }
    });
    
    // Remove from registry
    this.listeners = this.listeners.filter(l => l.eventName !== eventName);
    console.log(`[ListenerRegistry] Cleared ${toRemove.length} listener(s) for '${eventName}'`);
  }

  /**
   * Attach a single listener to the socket
   */
  private attachListener(listener: Listener): void {
    if (!this.socket?.connected) {
      console.log(`[ListenerRegistry] Socket not ready for '${listener.eventName}', will attach on connect`);
      return;
    }
    
    if (listener.attached) {
      console.log(`[ListenerRegistry] Listener for '${listener.eventName}' already attached`);
      return;
    }
    
    this.socket.on(listener.eventName, listener.handler);
    listener.attached = true;
    console.log(`[ListenerRegistry] Attached listener to '${listener.eventName}'`);
  }

  /**
   * Attach all pending listeners (those not yet attached)
   */
  private attachPendingListeners(): void {
    const pending = this.listeners.filter(l => !l.attached);
    console.log(`[ListenerRegistry] Attaching ${pending.length} pending listener(s)`);
    
    pending.forEach(listener => this.attachListener(listener));
  }

  /**
   * Reattach all listeners atomically after reconnection
   * This ensures no listener is missed
   */
  private reattachAllListeners(): void {
    // Prevent concurrent reattachment
    if (this.reattachInProgress) {
      console.log('[ListenerRegistry] Reattachment already in progress, skipping');
      return;
    }
    
    this.reattachInProgress = true;
    
    try {
      console.log(`[ListenerRegistry] Reattaching all ${this.listeners.length} listener(s)`);
      
      // First, detach all from socket to ensure clean slate
      this.listeners.forEach(listener => {
        if (listener.attached && this.socket) {
          this.socket.off(listener.eventName, listener.handler);
          listener.attached = false;
        }
      });
      
      // Then reattach all
      this.listeners.forEach(listener => this.attachListener(listener));
      
      console.log('[ListenerRegistry] Reattachment complete');
    } finally {
      this.reattachInProgress = false;
    }
  }

  /**
   * Mark all listeners as detached (for disconnect event)
   */
  private markAllListenersDetached(): void {
    this.listeners.forEach(listener => {
      listener.attached = false;
    });
    console.log(`[ListenerRegistry] Marked ${this.listeners.length} listener(s) as detached`);
  }

  /**
   * Get current registry state for debugging
   */
  getState() {
    return {
      socketConnected: this.socket?.connected ?? false,
      listenerCount: this.listeners.length,
      attachedCount: this.listeners.filter(l => l.attached).length,
      listeners: this.listeners.map(l => ({
        eventName: l.eventName,
        attached: l.attached
      }))
    };
  }

  /**
   * Clear entire registry (use with caution)
   */
  clear(): void {
    this.listeners.forEach(listener => {
      if (listener.attached && this.socket) {
        this.socket.off(listener.eventName, listener.handler);
      }
    });
    this.listeners = [];
    console.log('[ListenerRegistry] Registry cleared');
  }
}

// ========== MEMBER PRESENCE EVENT EXPORTS ==========
// These are convenience functions that use the registry to manage member presence events
// Previously these were called directly on socket in hooks - now they're centralized

let onMemberOnlineHandler: ((data: any) => void) | null = null;
let onMemberOfflineHandler: ((data: any) => void) | null = null;
let onMemberJoinedServerHandler: ((data: any) => void) | null = null;
let onMemberLeftServerHandler: ((data: any) => void) | null = null;

export const onMemberOnline = (handler: (data: any) => void): void => {
  // If there's already a handler registered, unregister it first
  if (onMemberOnlineHandler) {
    registry.off('member-online', onMemberOnlineHandler);
  }
  
  onMemberOnlineHandler = handler;
  registry.on('member-online', handler);
  console.log('[ListenerRegistry] Registered onMemberOnline handler');
};

export const offMemberOnline = (): void => {
  if (onMemberOnlineHandler) {
    registry.off('member-online', onMemberOnlineHandler);
    onMemberOnlineHandler = null;
    console.log('[ListenerRegistry] Unregistered onMemberOnline handler');
  }
};

export const onMemberOffline = (handler: (data: any) => void): void => {
  if (onMemberOfflineHandler) {
    registry.off('member-offline', onMemberOfflineHandler);
  }
  
  onMemberOfflineHandler = handler;
  registry.on('member-offline', handler);
  console.log('[ListenerRegistry] Registered onMemberOffline handler');
};

export const offMemberOffline = (): void => {
  if (onMemberOfflineHandler) {
    registry.off('member-offline', onMemberOfflineHandler);
    onMemberOfflineHandler = null;
    console.log('[ListenerRegistry] Unregistered onMemberOffline handler');
  }
};

export const onMemberJoinedServer = (handler: (data: any) => void): void => {
  if (onMemberJoinedServerHandler) {
    registry.off('member-joined-server', onMemberJoinedServerHandler);
  }
  
  onMemberJoinedServerHandler = handler;
  registry.on('member-joined-server', handler);
  console.log('[ListenerRegistry] Registered onMemberJoinedServer handler');
};

export const offMemberJoinedServer = (): void => {
  if (onMemberJoinedServerHandler) {
    registry.off('member-joined-server', onMemberJoinedServerHandler);
    onMemberJoinedServerHandler = null;
    console.log('[ListenerRegistry] Unregistered onMemberJoinedServer handler');
  }
};

export const onMemberLeftServer = (handler: (data: any) => void): void => {
  if (onMemberLeftServerHandler) {
    registry.off('member-left-server', onMemberLeftServerHandler);
  }
  
  onMemberLeftServerHandler = handler;
  registry.on('member-left-server', handler);
  console.log('[ListenerRegistry] Registered onMemberLeftServer handler');
};

export const offMemberLeftServer = (): void => {
  if (onMemberLeftServerHandler) {
    registry.off('member-left-server', onMemberLeftServerHandler);
    onMemberLeftServerHandler = null;
    console.log('[ListenerRegistry] Unregistered onMemberLeftServer handler');
  }
};

// ========== PROFILE & ACCOUNT CHANGE EVENTS (PHASE 5.1) ==========

let onProfilePictureChangedHandler: ((data: any) => void) | null = null;
let onServerProfileUpdatedHandler: ((data: any) => void) | null = null;
let onMemberVoiceStateChangedHandler: ((data: any) => void) | null = null;
let onUserAccountDeletedHandler: ((data: any) => void) | null = null;

export const onProfilePictureChanged = (handler: (data: any) => void): void => {
  if (onProfilePictureChangedHandler) {
    registry.off('profile-picture-changed', onProfilePictureChangedHandler);
  }
  
  onProfilePictureChangedHandler = handler;
  registry.on('profile-picture-changed', handler);
  console.log('[ListenerRegistry] Registered onProfilePictureChanged handler');
};

export const offProfilePictureChanged = (): void => {
  if (onProfilePictureChangedHandler) {
    registry.off('profile-picture-changed', onProfilePictureChangedHandler);
    onProfilePictureChangedHandler = null;
    console.log('[ListenerRegistry] Unregistered onProfilePictureChanged handler');
  }
};

export const onServerProfileUpdated = (handler: (data: any) => void): void => {
  if (onServerProfileUpdatedHandler) {
    registry.off('server-profile-updated', onServerProfileUpdatedHandler);
  }
  
  onServerProfileUpdatedHandler = handler;
  registry.on('server-profile-updated', handler);
  console.log('[ListenerRegistry] Registered onServerProfileUpdated handler');
};

export const offServerProfileUpdated = (): void => {
  if (onServerProfileUpdatedHandler) {
    registry.off('server-profile-updated', onServerProfileUpdatedHandler);
    onServerProfileUpdatedHandler = null;
    console.log('[ListenerRegistry] Unregistered onServerProfileUpdated handler');
  }
};

export const onMemberVoiceStateChanged = (handler: (data: any) => void): void => {
  if (onMemberVoiceStateChangedHandler) {
    registry.off('member-voice-state-changed', onMemberVoiceStateChangedHandler);
  }
  
  onMemberVoiceStateChangedHandler = handler;
  registry.on('member-voice-state-changed', handler);
  console.log('[ListenerRegistry] Registered onMemberVoiceStateChanged handler');
};

export const offMemberVoiceStateChanged = (): void => {
  if (onMemberVoiceStateChangedHandler) {
    registry.off('member-voice-state-changed', onMemberVoiceStateChangedHandler);
    onMemberVoiceStateChangedHandler = null;
    console.log('[ListenerRegistry] Unregistered onMemberVoiceStateChanged handler');
  }
};

export const onUserAccountDeleted = (handler: (data: any) => void): void => {
  if (onUserAccountDeletedHandler) {
    registry.off('user-account-deleted', onUserAccountDeletedHandler);
  }
  
  onUserAccountDeletedHandler = handler;
  registry.on('user-account-deleted', handler);
  console.log('[ListenerRegistry] Registered onUserAccountDeleted handler');
};

export const offUserAccountDeleted = (): void => {
  if (onUserAccountDeletedHandler) {
    registry.off('user-account-deleted', onUserAccountDeletedHandler);
    onUserAccountDeletedHandler = null;
    console.log('[ListenerRegistry] Unregistered onUserAccountDeleted handler');
  }
};

// Export singleton registry instance
const registry = new ListenerRegistry();

export default registry;
