// src/hooks/useServerMembers.ts
import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import { getSocket } from '../services/socketService';

export interface MemberProfile {
  userId: string;
  username: string;
  profilePicture?: string;
  serverSpecificName?: string;
}

interface UseServerMembersResult {
  members: MemberProfile[];
  onlineUserIds: Set<string>;
  loading: boolean;
  error: string;
}

/**
 * Fetches all members for a server and keeps their online/offline status
 * in sync via Socket.IO presence events.
 */
export const useServerMembers = (serverId?: string): UseServerMembersResult => {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep a ref to the latest onlineUserIds so the socket handlers
  // don't close over a stale value.
  const onlineRef = useRef<Set<string>>(onlineUserIds);
  onlineRef.current = onlineUserIds;

  // Store listener references so we can properly remove them later (avoid duplicates)
  const listenersRef = useRef<{
    handleOnline?: (data: { userId: string }) => void;
    handleOffline?: (data: { userId: string }) => void;
    handleMemberJoined?: (data: any) => void;
    handleMemberLeft?: (data: { userId: string }) => void;
  }>({});

  // Track if listeners are attached to prevent duplicates
  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    if (!serverId) {
      setMembers([]);
      setOnlineUserIds(new Set());
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [profilesRes, onlineRes] = await Promise.all([
          authFetch(`api/servers/${serverId}/members/profiles`),
          authFetch(`api/servers/${serverId}/members/online`),
        ]);

        if (cancelled) return;

        if (profilesRes.ok) {
          const data = await profilesRes.json();
          setMembers(data.members || []);
        } else {
          setError('Failed to load members');
        }

        if (onlineRes.ok) {
          const data = await onlineRes.json();
          setOnlineUserIds(new Set<string>(data.onlineUserIds || []));
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load members');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    // ── Real-time presence via Socket.IO ──────────────────────────────────────
    const socket = getSocket();

    if (!socket) {
      console.warn('[useServerMembers] Socket not initialized yet for serverId:', serverId);
      return;
    }

    // Create handler functions if they don't exist yet
    if (!listenersRef.current.handleOnline) {
      listenersRef.current.handleOnline = ({ userId }: { userId: string }) => {
        if (!cancelled) {
          setOnlineUserIds(prev => new Set([...prev, userId]));
        }
      };
    }

    if (!listenersRef.current.handleOffline) {
      listenersRef.current.handleOffline = ({ userId }: { userId: string }) => {
        if (!cancelled) {
          setOnlineUserIds(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }
      };
    }

    if (!listenersRef.current.handleMemberJoined) {
      listenersRef.current.handleMemberJoined = (memberData: any) => {
        if (cancelled) return;
        // Add the new member to the members list
        const newMember: MemberProfile = {
          userId: memberData.userId,
          username: memberData.username,
          profilePicture: memberData.profilePicture,
          serverSpecificName: memberData.serverSpecificName,
        };
        setMembers(prev => {
          // Avoid duplicates
          if (prev.some(m => m.userId === memberData.userId)) {
            return prev;
          }
          return [...prev, newMember];
        });
        // Mark as online since they just joined
        setOnlineUserIds(prev => new Set([...prev, memberData.userId]));
      };
    }

    if (!listenersRef.current.handleMemberLeft) {
      listenersRef.current.handleMemberLeft = ({ userId }: { userId: string }) => {
        if (cancelled) return;
        // Remove the member from the members list
        setMembers(prev => prev.filter(m => m.userId !== userId));
        // Remove from online set
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      };
    }

    // Function to attach all listeners
    const attachListeners = () => {
      if (listenersAttachedRef.current) {
        console.warn('[useServerMembers] Listeners already attached, skipping');
        return; // Already attached
      }

      socket.on('member-online', listenersRef.current.handleOnline!);
      socket.on('member-offline', listenersRef.current.handleOffline!);
      socket.on('member-joined-server', listenersRef.current.handleMemberJoined!);
      socket.on('member-left-server', listenersRef.current.handleMemberLeft!);
      listenersAttachedRef.current = true;

      console.log('[useServerMembers] Listeners attached for serverId:', serverId);
    };

    // Listen for socket reconnection — when socket reconnects, listeners need to be reattached
    const onReconnect = () => {
      console.log('[useServerMembers] Socket reconnected, resetting listeners flag');
      listenersAttachedRef.current = false;
      attachListeners();
    };

    socket.on('reconnect', onReconnect);

    // If socket is already connected, attach listeners immediately
    if (socket.connected) {
      attachListeners();
    } else {
      // Otherwise wait for connection, then attach
      console.log('[useServerMembers] Socket not connected yet, waiting for connection...');
      let connectListener: (() => void) | null = null;

      connectListener = () => {
        if (!cancelled) {
          attachListeners();
          socket.off('connect', connectListener!);
        }
      };

      socket.on('connect', connectListener);

      // Clean up the connect listener if component unmounts before connection
      const cleanupConnectListener = () => {
        if (connectListener) {
          socket.off('connect', connectListener);
        }
      };

      return () => {
        cancelled = true;
        cleanupConnectListener();
        socket.off('reconnect', onReconnect);
        // Remove the state listeners if they were attached
        if (listenersAttachedRef.current && listenersRef.current.handleOnline) {
          socket.off('member-online', listenersRef.current.handleOnline);
          socket.off('member-offline', listenersRef.current.handleOffline!);
          socket.off('member-joined-server', listenersRef.current.handleMemberJoined!);
          socket.off('member-left-server', listenersRef.current.handleMemberLeft!);
          listenersAttachedRef.current = false;

          console.log('[useServerMembers] Listeners removed for serverId:', serverId);
        }
      };
    }

    return () => {
      cancelled = true;
      socket.off('reconnect', onReconnect);
      // Only remove listeners if they were actually attached
      if (listenersAttachedRef.current && listenersRef.current.handleOnline) {
        socket.off('member-online', listenersRef.current.handleOnline);
        socket.off('member-offline', listenersRef.current.handleOffline!);
        socket.off('member-joined-server', listenersRef.current.handleMemberJoined!);
        socket.off('member-left-server', listenersRef.current.handleMemberLeft!);
        listenersAttachedRef.current = false;

        console.log('[useServerMembers] Listeners removed for serverId:', serverId);
      }
    };
  }, [serverId]);

  return { members, onlineUserIds, loading, error };
};
