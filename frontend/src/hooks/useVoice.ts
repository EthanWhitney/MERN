import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, initSocket } from '../services/socketService';

interface Peer {
  socketId: string;
  userId: string;
  username: string;
  isMuted?: boolean;
  isDeafened?: boolean;
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

interface RemoteUserState {
  userId: string;
  username: string;
  isMuted?: boolean;
  isDeafened?: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Load persistent mute/deafen state from localStorage
const loadVoiceSettings = () => {
  try {
    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        isMuted: parsed.isMuted ?? false,
        isDeafened: parsed.isDeafened ?? false,
      };
    }
  } catch (e) {
    console.error('Failed to load voice settings:', e);
  }
  return { isMuted: false, isDeafened: false };
};

// Save voice settings to localStorage
const saveVoiceSettings = (isMuted: boolean, isDeafened: boolean) => {
  try {
    localStorage.setItem('voiceSettings', JSON.stringify({ isMuted, isDeafened }));
  } catch (e) {
    console.error('Failed to save voice settings:', e);
  }
};

export const useVoice = (channelId: string, userId: string) => {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUserState>>({});
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTracksRef = useRef<MediaStreamTrack[]>([]);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    if (!channelId || !userId) return;

    // Load persistent mute/deafen state
    const { isMuted: savedIsMuted, isDeafened: savedIsDeafened } = loadVoiceSettings();
    setIsMuted(savedIsMuted);
    setIsDeafened(savedIsDeafened);

    const initVoice = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            autoGainControl: true 
          }, 
          video: false 
        });
        
        localStreamRef.current = mediaStream;
        audioTracksRef.current = mediaStream.getAudioTracks();
        
        // Apply persistent mute/deafen state immediately
        if (savedIsMuted || savedIsDeafened) {
          audioTracksRef.current.forEach(track => {
            track.enabled = !savedIsMuted && !savedIsDeafened;
          });
        }
        
        setIsConnected(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
        return;
      }

      // 1. Grab your own username
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      const myUsername = userData.username || 'Unknown';

      const socket = getSocket() || initSocket(userId);
      socketRef.current = socket;

      if (socket.connected) {
        socket.emit('join-voice', { 
          channelId, 
          userId, 
          username: myUsername,
          isMuted: savedIsMuted,
          isDeafened: savedIsDeafened,
        });
      } else {
        socket.on('connect', () => {
          socket.emit('join-voice', { 
            channelId, 
            userId, 
            username: myUsername,
            isMuted: savedIsMuted,
            isDeafened: savedIsDeafened,
          });
        });
      }

      socket.on('existing-peers', async ({ peers }: { peers: Peer[] }) => {
        if (!localStreamRef.current) return;
        
        for (const peer of peers) {
          setRemoteUsers(prev => ({ ...prev, [peer.socketId]: { userId: peer.userId, username: peer.username, isMuted: peer.isMuted, isDeafened: peer.isDeafened } }));
          const pc = createPeer(peer.socketId, socket, localStreamRef.current);
          peersRef.current[peer.socketId] = pc;
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: peer.socketId, userId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userId: remoteUserId, username: remoteUsername, isMuted: remoteIsMuted, isDeafened: remoteIsDeafened }: { socketId: string, userId: string, username: string, isMuted?: boolean, isDeafened?: boolean }) => {
        if (!localStreamRef.current) return;
        setRemoteUsers(prev => ({ ...prev, [socketId]: { userId: remoteUserId, username: remoteUsername, isMuted: remoteIsMuted, isDeafened: remoteIsDeafened } })); 
        const pc = createPeer(socketId, socket, localStreamRef.current);
        peersRef.current[socketId] = pc;
      });

      socket.on('offer', async ({ from, offer }: OfferPayload) => {
        const pc = peersRef.current[from];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
      });

      socket.on('answer', async ({ from, answer }: AnswerPayload) => {
        const pc = peersRef.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('ice-candidate', async ({ from, candidate }: IceCandidatePayload) => {
        const pc = peersRef.current[from];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on('user-muted', ({ socketId, isMuted: remoteMuted }: { socketId: string, isMuted: boolean }) => {
        setRemoteUsers(prev => ({
          ...prev,
          [socketId]: { ...prev[socketId], isMuted: remoteMuted }
        }));
      });

      socket.on('user-deafened', ({ socketId, isDeafened: remoteDeafened }: { socketId: string, isDeafened: boolean }) => {
        setRemoteUsers(prev => ({
          ...prev,
          [socketId]: { ...prev[socketId], isDeafened: remoteDeafened }
        }));
      });

      socket.on('user-left', ({ socketId }: { socketId: string }) => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
          delete peersRef.current[socketId];
        }
        setRemoteUsers(prev => { const n = {...prev}; delete n[socketId]; return n; });
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[socketId];
          return newStreams;
        });
      });
    };

    const createPeer = (peerSocketId: string, socket: Socket, localStream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: peerSocketId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({ ...prev, [peerSocketId]: event.streams[0] }));
      };

      return pc;
    };

    initVoice();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-voice', { channelId, userId });
        socketRef.current.off('existing-peers');
        socketRef.current.off('user-joined');
        socketRef.current.off('offer');
        socketRef.current.off('answer');
        socketRef.current.off('ice-candidate');
        socketRef.current.off('user-muted');
        socketRef.current.off('user-deafened');
        socketRef.current.off('user-left');
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
    };
  }, [channelId, userId]);

  // Control methods for mute/deafen
  const muteAudio = () => {
    setIsMuted(true);
    audioTracksRef.current.forEach(track => {
      track.enabled = false;
    });
    saveVoiceSettings(true, isDeafened);
    if (socketRef.current) {
      socketRef.current.emit('user-muted', { channelId, userId, isMuted: true });
    }
  };

  const unmuteAudio = () => {
    setIsMuted(false);
    audioTracksRef.current.forEach(track => {
      track.enabled = !isDeafened; // Only enable if not deafened
    });
    saveVoiceSettings(false, isDeafened);
    if (socketRef.current) {
      socketRef.current.emit('user-muted', { channelId, userId, isMuted: false });
    }
  };

  const deafenAudio = () => {
    setIsDeafened(true);
    // Disable local audio tracks (mic)
    audioTracksRef.current.forEach(track => {
      track.enabled = false;
    });
    saveVoiceSettings(isMuted, true);
    if (socketRef.current) {
      socketRef.current.emit('user-deafened', { channelId, userId, isDeafened: true });
    }
  };

  const undeafenAudio = () => {
    setIsDeafened(false);
    // Re-enable audio tracks if not muted
    audioTracksRef.current.forEach(track => {
      track.enabled = !isMuted;
    });
    saveVoiceSettings(isMuted, false);
    if (socketRef.current) {
      socketRef.current.emit('user-deafened', { channelId, userId, isDeafened: false });
    }
  };

  return { 
    isConnected, 
    remoteStreams, 
    remoteUsers,
    isMuted,
    isDeafened,
    muteAudio,
    unmuteAudio,
    deafenAudio,
    undeafenAudio,
  };
};