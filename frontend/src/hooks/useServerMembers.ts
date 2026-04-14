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
      return;
    }

    const handleOnline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => new Set([...prev, userId]));
    };

    const handleOffline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleMemberJoined = (memberData: any) => {
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
      // Remove the member from the members list
      setMembers(prev => prev.filter(m => m.userId !== userId));
      // Remove from online set
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on('member-online', handleOnline);
    socket.on('member-offline', handleOffline);
    socket.on('member-joined-server', handleMemberJoined);
    socket.on('member-left-server', handleMemberLeft);

    return () => {
      cancelled = true;
      socket.off('member-online', handleOnline);
      socket.off('member-offline', handleOffline);
      socket.off('member-joined-server', handleMemberJoined);
      socket.off('member-left-server', handleMemberLeft);
    };
  }, [serverId]);

  return { members, onlineUserIds, loading, error };
};
