/**
 * PHASE 3.3: Connection Status Indicator Hook
 * 
 * Provides connection status to components with auto-update
 * 
 * Usage:
 *   const { connected, reconnecting, status } = useConnectionStatus()
 */

import { useEffect, useState } from 'react';
import { getSocket, getConnectionState } from '../services/socketService';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseConnectionStatusResult {
  status: ConnectionStatus;
  connected: boolean;
  reconnecting: boolean;
  disconnected: boolean;
}

/**
 * Hook to track socket connection status
 * Updates when connection state changes via connectionState counter
 */
export const useConnectionStatus = (): UseConnectionStatusResult => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const connectionState = getConnectionState();

  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      setStatus('disconnected');
      return;
    }

    // Function to update status based on socket state
    const updateStatus = () => {
      if (socket.connected) {
        setStatus('connected');
      } else if (socket.io.engine.readyState === 'opening') {
        setStatus('reconnecting');
      } else {
        setStatus('disconnected');
      }
    };

    // Update immediately
    updateStatus();

    // Listen for socket events that change status
    const handlers = {
      connect: () => setStatus('connected'),
      disconnect: () => setStatus('disconnected'),
      connect_error: () => setStatus('reconnecting'),
      reconnect: () => setStatus('connected'),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler as any);
      });
    };
  }, [connectionState]); // Re-run when connectionState changes (triggers on reconnect)

  return {
    status,
    connected: status === 'connected',
    reconnecting: status === 'reconnecting',
    disconnected: status === 'disconnected'
  };
};
