import React, { useEffect, useRef } from 'react';
import { useVoice } from '../hooks/useVoice';

interface AudioPlayerProps {
  stream: MediaStream;
}

// helper component for the audio element
const AudioPlayer: React.FC<AudioPlayerProps> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  currentUserId: string;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({ 
  channelId, 
  channelName, 
  currentUserId 
}) => {
  const { isConnected, remoteStreams } = useVoice(channelId, currentUserId);

  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const myUsername = userData.username || 'Me';

  return (
    <div className="bg-[#1e1f22] text-white p-6 rounded-lg w-full max-w-2xl mx-auto mt-10 shadow-xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-green-500">🔊</span> {channelName}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        
        <div className="bg-[#2b2d31] p-4 rounded-md flex flex-col items-center border-2 border-green-500/50">
          <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-xl font-bold mb-2">
            {myUsername[0].toUpperCase()}
          </div>
          <span className="font-medium">{myUsername} (You)</span>
          <div className="text-xs text-green-400 mt-1">Connected</div>
        </div>

        {Object.entries(remoteStreams).map(([socketId, stream]) => (
          <div key={socketId} className="bg-[#2b2d31] p-4 rounded-md flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-xl font-bold mb-2">
              ?
            </div>
            <span className="font-medium text-gray-300">User {socketId.slice(0, 4)}</span>
            <AudioPlayer stream={stream} />
          </div>
        ))}
      </div>

      <button 
        onClick={() => window.location.reload()} 
        className="mt-8 w-full bg-[#da373c] hover:bg-[#a1282c] text-white font-bold py-2 px-4 rounded transition"
      >
        Leave Call
      </button>
    </div>
  );
};