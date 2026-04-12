import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
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

const getSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:5000' : window.location.origin;
};


export const useVoice = (channelId: string, userId: string) => {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
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

      // con to socket server
      const socket = getSocket() || initSocket(userId);
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join-voice', { channelId, userId });
      });

      // signal listeners
      socket.on('existing-peers', async ({ peers }: { peers: Peer[] }) => {
        if (!localStreamRef.current) return;
        
        for (const peer of peers) {
          const pc = createPeer(peer.socketId, socket, localStreamRef.current);
          peersRef.current[peer.socketId] = pc;
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: peer.socketId, userId, offer });
        }
      });

      socket.on('user-joined', ({ socketId }: { socketId: string }) => {
        if (!localStreamRef.current) return;
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
      if (socketRef.current) socketRef.current.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [channelId, userId]);

  return { isConnected, remoteStreams };
};