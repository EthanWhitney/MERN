import React, { useEffect, useRef } from 'react';
import { useVoice } from '../hooks/useVoice';

const AudioPlayer: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline />;
};

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  currentUserId: string;
  onLeave: () => void;
  serverProfiles?: any[];
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  currentUserId,
  onLeave,
  serverProfiles = [],
}) => {
  const { remoteStreams, remoteUsers } = useVoice(channelId, currentUserId);
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const myUsername = userData.username || 'Me';

  return (
    <div style={{
      borderTop: '1px solid #3f3f3f',
      background: '#232428',
      padding: '8px',
    }}>
      {/* Voice connected bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#23a559', fontSize: '11px', fontWeight: 600 }}>
            🔊 Voice Connected
          </span>
        </div>
        <button
          onClick={() => { onLeave(); }}
          title="Disconnect"
          style={{
            background: 'none', border: 'none', color: '#ed4245',
            cursor: 'pointer', padding: '2px 4px', borderRadius: '4px',
            fontSize: '16px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#96989d', marginBottom: '4px' }}>
        {channelName}
      </div>

      {/* Users in channel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Self */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px', borderRadius: '4px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#5865f2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'white',
          }}>
            {myUsername[0].toUpperCase()}
          </div>
          <span style={{ color: '#dbdee1', fontSize: '13px' }}>{myUsername}</span>
          <span style={{ marginLeft: 'auto', fontSize: '14px' }}>🎤</span>
        </div>
        

        {/* Remote users */}
      {Object.entries(remoteStreams).map(([socketId, stream]) => {
        const userId = remoteUsers[socketId];
        console.log("DEBUG JSON:", JSON.stringify({ lookingFor: userId, firstUser: serverProfiles[0] }, null, 2));
        const profile = serverProfiles.find(p => 
          p._id === userId || 
          p.id === userId || 
          p.userId === userId
        );

        const name = profile?.username || profile?.displayName || profile?.name || 'Unknown';
        
        return (
          <div key={socketId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#4e5058', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'white',
            }}>
              {name[0]?.toUpperCase() || '?'}
            </div>
            <span style={{ color: '#dbdee1', fontSize: '13px' }}>{name}</span>
            <span style={{ marginLeft: 'auto', fontSize: '14px' }}>🎤</span>
            <AudioPlayer stream={stream} />
          </div>
        );
      })}
      </div>
    </div>
  );
};