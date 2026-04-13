import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, initSocket } from '../services/socketService';

interface Peer {
  socketId: string;
  userId: string;
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

export const useVoice = (channelId: string, userId: string) => {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, string>>({});

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    console.log("Voice Hook Triggered. Channel:", channelId, "| User:", userId);

    if (!channelId || !userId) {
        console.warn("Aborting: Missing channelId or userId!");
        return;
    }

    const initVoice = async () => {
      console.log("Data is good, starting microphone check...");
      
      // get mic access
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setIsConnected(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
        return;
      }

      const socket = getSocket() || initSocket(userId);
      socketRef.current = socket;

      if (socket.connected) {
        socket.emit('join-voice', { channelId, userId });
      } else {
        socket.on('connect', () => {
          socket.emit('join-voice', { channelId, userId });
        });
      }

      socket.on('existing-peers', async ({ peers }: { peers: Peer[] }) => {
        if (!localStreamRef.current) return;
        
        for (const peer of peers) {
          setRemoteUsers(prev => ({ ...prev, [peer.socketId]: peer.userId }));
          const pc = createPeer(peer.socketId, socket, localStreamRef.current);
          peersRef.current[peer.socketId] = pc;
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: peer.socketId, userId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userId: remoteUserId }: { socketId: string, userId: string }) => {
        if (!localStreamRef.current) return;
        setRemoteUsers(prev => ({ ...prev, [socketId]: remoteUserId })); // Use the remote ID, not yours
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

    // helper to create a new peer con
    const createPeer = (peerSocketId: string, socket: Socket, localStream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: peerSocketId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [peerSocketId]: event.streams[0]
        }));
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
        socketRef.current.off('user-left');
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
    };
  }, [channelId, userId]);

  return { isConnected, remoteStreams, remoteUsers };
};