import React, { createContext, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, initSocket } from '../services/socketService';

interface Peer {
  socketId: string;
  userId: string;
  username: string;
}

interface OfferPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface AnswerPayload {
  from: string;
  answer: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  from: string;
  candidate: RTCIceCandidateInit;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface AudioConnectionContextType {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteUsers: Record<string, { userId: string; username: string }>;
  isAudioConnected: boolean;
  currentChannelId: string | null;
  initiateAudioConnection: (channelId: string, userId: string) => Promise<void>;
  disconnectAudio: () => Promise<void>;
}

export const AudioConnectionContext = createContext<AudioConnectionContextType | undefined>(undefined);

export const AudioConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteUsers, setRemoteUsers] = useState<Record<string, { userId: string; username: string }>>({});
  const [isAudioConnected, setIsAudioConnected] = useState(false);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const socketRef = useRef<Socket | null>(null);
  const currentChannelRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const listenersSetupRef = useRef<boolean>(false);

  const initiateAudioConnection = useCallback(async (channelId: string, userId: string) => {
    try {
      // If already connected to this channel, do nothing
      if (currentChannelRef.current === channelId && localStreamRef.current) {
        console.log('[AudioContext] Already connected to channel:', channelId);
        return;
      }

      // If switching channels, clean up old connections first
      if (currentChannelRef.current && currentChannelRef.current !== channelId) {
        console.log('[AudioContext] Switching from channel', currentChannelRef.current, 'to', channelId);
        
        // Close all existing peer connections for old channel
        Object.values(peersRef.current).forEach(pc => pc.close());
        peersRef.current = {};
        
        // Clear remote streams and users
        setRemoteStreams({});
        setRemoteUsers({});

        // Notify backend we're leaving the old channel
        if (socketRef.current && currentUserIdRef.current) {
          socketRef.current.emit('leave-voice', { 
            channelId: currentChannelRef.current, 
            userId: currentUserIdRef.current 
          });
        }
      }

      currentChannelRef.current = channelId;
      currentUserIdRef.current = userId;
      setCurrentChannelId(channelId);

      // Get audio stream if we don't have one
      if (!localStreamRef.current) {
        console.log('[AudioContext] Getting microphone access');
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(localStreamRef.current);
      }

      setIsAudioConnected(true);

      // Get username
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      const myUsername = userData.username || 'Unknown';

      // Get or initialize socket
      const socket = socketRef.current || getSocket() || initSocket(userId);
      socketRef.current = socket;

      // Emit join-voice with channelId
      console.log('[AudioContext] Joining voice channel:', channelId);
      if (socket.connected) {
        socket.emit('join-voice', { channelId, userId, username: myUsername });
      } else {
        socket.once('connect', () => {
          socket.emit('join-voice', { channelId, userId, username: myUsername });
        });
      }

      // Set up event listeners (set up fresh each time to ensure channel-specific filtering)
      // Remove old listeners if they exist
      socket.off('existing-peers');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');

      // Add new listeners with channel filtering
      socket.on('existing-peers', async ({ peers, channelId: incomingChannelId }: { peers: Peer[]; channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;
        if (!localStreamRef.current) return;

        console.log('[AudioContext] Received existing peers for channel:', channelId, 'peers:', peers.length);

        for (const peer of peers) {
          if (peersRef.current[peer.socketId]) continue; // Already connected

          setRemoteUsers(prev => ({ ...prev, [peer.socketId]: { userId: peer.userId, username: peer.username } }));
          const pc = createPeer(peer.socketId, socketRef.current!, localStreamRef.current, channelId);
          peersRef.current[peer.socketId] = pc;

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: peer.socketId, userId, channelId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userId: remoteUserId, username: remoteUsername, channelId: incomingChannelId }: { socketId: string; userId: string; username: string; channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;
        if (!localStreamRef.current) return;

        console.log('[AudioContext] User joined channel:', channelId, 'socketId:', socketId);
        setRemoteUsers(prev => ({ ...prev, [socketId]: { userId: remoteUserId, username: remoteUsername } }));
        const pc = createPeer(socketId, socketRef.current!, localStreamRef.current, channelId);
        peersRef.current[socketId] = pc;
      });

      socket.on('offer', async ({ from, offer, channelId: incomingChannelId }: OfferPayload & { channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;
        
        const pc = peersRef.current[from];
        if (!pc) return;
        console.log('[AudioContext] Received offer from:', from, 'for channel:', channelId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer, channelId });
      });

      socket.on('answer', async ({ from, answer, channelId: incomingChannelId }: AnswerPayload & { channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;

        const pc = peersRef.current[from];
        if (pc) {
          console.log('[AudioContext] Received answer from:', from, 'for channel:', channelId);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('ice-candidate', async ({ from, candidate, channelId: incomingChannelId }: IceCandidatePayload & { channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;

        const pc = peersRef.current[from];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on('user-left', ({ socketId, channelId: incomingChannelId }: { socketId: string; channelId: string }) => {
        // Filter events for current channel only
        if (incomingChannelId !== channelId) return;

        console.log('[AudioContext] User left channel:', channelId, 'socketId:', socketId);
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
          delete peersRef.current[socketId];
        }
        setRemoteUsers(prev => {
          const n = { ...prev };
          delete n[socketId];
          return n;
        });
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[socketId];
          return newStreams;
        });
      });

      listenersSetupRef.current = true;
      console.log('[AudioContext] Event listeners set up for channel:', channelId);
    } catch (err) {
      console.error('Failed to initialize audio connection:', err);
      setIsAudioConnected(false);
    }
  }, []);

  const disconnectAudio = useCallback(async () => {
    try {
      if (socketRef.current && currentChannelRef.current && currentUserIdRef.current) {
        socketRef.current.emit('leave-voice', { channelId: currentChannelRef.current, userId: currentUserIdRef.current });
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }

      // Close all peer connections
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};

      // Clear remote streams and users
      setRemoteStreams({});
      setRemoteUsers({});

      currentChannelRef.current = null;
      currentUserIdRef.current = null;
      setIsAudioConnected(false);
    } catch (err) {
      console.error('Failed to disconnect audio:', err);
    }
  }, []);

  const createPeer = (peerSocketId: string, socket: Socket, localStream: MediaStream, channelId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: peerSocketId, candidate: event.candidate, channelId });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [peerSocketId]: event.streams[0] }));
    };

    return pc;
  };

  return (
    <AudioConnectionContext.Provider
      value={{
        localStream,
        remoteStreams,
        remoteUsers,
        isAudioConnected,
        currentChannelId,
        initiateAudioConnection,
        disconnectAudio,
      }}
    >
      {children}
    </AudioConnectionContext.Provider>
  );
};

export const useAudioConnection = () => {
  const context = React.useContext(AudioConnectionContext);
  if (!context) {
    throw new Error('useAudioConnection must be used within AudioConnectionProvider');
  }
  return context;
};
