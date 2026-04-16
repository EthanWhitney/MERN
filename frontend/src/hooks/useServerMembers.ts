// src/hooks/useServerMembers.ts
import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import {
  onMemberOnline,
  offMemberOnline,
  onMemberOffline,
  offMemberOffline,
  onMemberJoinedServer,
  offMemberJoinedServer,
  onMemberLeftServer,
  offMemberLeftServer,
  onServerProfileUpdated,
  offServerProfileUpdated,
  onMemberVoiceStateChanged,
  offMemberVoiceStateChanged,
} from '../services/listenerRegistry';
import eventDeduplication from '../services/eventDeduplication';

export interface MemberProfile {
  userId: string;
  username: string;
  profilePicture?: string;
  serverSpecificName?: string;
  voiceState?: {
    muted?: boolean;
    deafened?: boolean;
  };
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

  // Track if listeners are registered with the registry
  const listenersRegisteredRef = useRef(false);

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

    // ========== PHASE 2: Use Listener Registry Instead of Direct Socket.on() ==========
    // Register handlers with the listener registry - it handles reconnection automatically
    
    const handleOnline = ({ userId }: { userId: string }) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('member-online', { userId })) {
        return;
      }
      
      if (!cancelled) {
        setOnlineUserIds(prev => new Set([...prev, userId]));
      }
    };

    const handleOffline = ({ userId }: { userId: string }) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('member-offline', { userId })) {
        return;
      }
      
      if (!cancelled) {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    const handleMemberJoined = (memberData: any) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('member-joined-server', memberData)) {
        return;
      }
      
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

    const handleMemberLeft = ({ userId }: { userId: string }) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('member-left-server', { userId })) {
        return;
      }
      
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

    const handleServerProfileUpdated = (data: any) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('server-profile-updated', data)) {
        return;
      }

      if (cancelled) return;
      const { userId: changedUserId, updates } = data;
      
      // Update the member's server profile fields (serverSpecificName, profilePicture, etc.)
      setMembers(prev =>
        prev.map(member =>
          member.userId === changedUserId
            ? {
                ...member,
                ...(updates.serverSpecificName !== undefined && { serverSpecificName: updates.serverSpecificName }),
                ...(updates.profilePicture !== undefined && { profilePicture: updates.profilePicture }),
              }
            : member
        )
      );
    };

    const handleMemberVoiceStateChanged = (data: any) => {
      // ========== PHASE 4.1: Event Deduplication ==========
      if (eventDeduplication.isDuplicate('member-voice-state-changed', data)) {
        return;
      }

      if (cancelled) return;
      const { userId: changedUserId, voiceState } = data;
      
      // Update the member's voice state
      setMembers(prev =>
        prev.map(member =>
          member.userId === changedUserId
            ? {
                ...member,
                voiceState,
              }
            : member
        )
      );
    };

    // Register listeners with the registry
    if (!listenersRegisteredRef.current) {
      console.log('[useServerMembers] Registering listeners with registry for serverId:', serverId);
      onMemberOnline(handleOnline);
      onMemberOffline(handleOffline);
      onMemberJoinedServer(handleMemberJoined);
      onMemberLeftServer(handleMemberLeft);
      onServerProfileUpdated(handleServerProfileUpdated);
      onMemberVoiceStateChanged(handleMemberVoiceStateChanged);
      listenersRegisteredRef.current = true;
    }

    // Cleanup: Unregister listeners when component unmounts or serverId changes
    return () => {
      cancelled = true;
      if (listenersRegisteredRef.current) {
        console.log('[useServerMembers] Unregistering listeners for serverId:', serverId);
        offMemberOnline();
        offMemberOffline();
        offMemberJoinedServer();
        offMemberLeftServer();
        offServerProfileUpdated();
        offMemberVoiceStateChanged();
        listenersRegisteredRef.current = false;
      }
    };
  }, [serverId]);

  // ========== PHASE 3.4: Refresh members online status on socket connection ==========
  // When socket connects, refresh the online member list to get updated status
  useEffect(() => {
    if (!serverId) return;

    // Refresh online status after socket connects
    const timer = setTimeout(async () => {
      console.log('[useServerMembers] Refreshing members online status after socket ready');
      try {
        const onlineRes = await authFetch(`api/servers/${serverId}/members/online`);
        if (onlineRes.ok) {
          const data = await onlineRes.json();
          setOnlineUserIds(new Set<string>(data.onlineUserIds || []));
        }
      } catch (err) {
        console.error('[useServerMembers] Error refreshing online members:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [serverId]);

  return { members, onlineUserIds, loading, error };
};
