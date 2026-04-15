import React, { useRef } from 'react';
import { useAudioConnection } from '../context/AudioConnectionContext';

const AudioPlayer: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline />;
};

interface VoiceChannelProps {
  channelName: string;
  onLeave: () => void;
  serverProfiles?: any[];
  currentUserProfile?: any;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelName,
  onLeave,
  serverProfiles = [],
  currentUserProfile,
}) => {
  const { remoteStreams, remoteUsers } = useAudioConnection();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  
  // Use server-specific profile if available, otherwise fall back to user data
  const displayName = currentUserProfile?.serverSpecificName || currentUserProfile?.username || userData.username || 'Me';

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
          onClick={onLeave}
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
            {displayName[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ color: '#dbdee1', fontSize: '13px' }}>{displayName}</span>
          <span style={{ marginLeft: 'auto', fontSize: '14px' }}>🎤</span>
        </div>

        {/* Remote users */}
        {Object.entries(remoteStreams).map(([socketId, stream]) => {
          const remoteUser = remoteUsers[socketId];
          const userId = remoteUser?.userId;
          const socketUsername = remoteUser?.username;
          
          // Find profile by userId, comparing as strings to handle ObjectId vs string comparison
          const profile = serverProfiles.find(p => {
            const pUserId = typeof p.userId === 'object' ? (p.userId as any).toString() : String(p.userId);
            const uId = typeof userId === 'object' ? (userId as any).toString() : String(userId);
            return pUserId === uId;
          });

          const name = profile?.serverSpecificName || profile?.username || socketUsername || 'Unknown';
          
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