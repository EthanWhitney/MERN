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
  const { remoteStreams, remoteUsers, isMuted, isDeafened } = useVoice(channelId, currentUserId);
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const myUsername = userData.username || 'Me';

  // Helper to render status badge
  const renderStatusBadge = (muted?: boolean, deafened?: boolean) => {
    if (deafened) {
      return <span style={{ fontSize: '12px' }} title="Deafened">🔈</span>;
    }
    if (muted) {
      return <span style={{ fontSize: '12px' }} title="Muted">🔇</span>;
    }
    return null;
  };

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
            position: 'relative',
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#5865f2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'white',
          }}>
            {myUsername[0]?.toUpperCase() || '?'}
            {/* Status badge - bottom right corner */}
            {renderStatusBadge(isMuted, isDeafened) && (
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: '#232428',
                borderRadius: '50%',
                padding: '1px',
              }}>
                {renderStatusBadge(isMuted, isDeafened)}
              </div>
            )}
          </div>
          <span style={{ color: '#dbdee1', fontSize: '13px' }}>{myUsername}</span>
          <span style={{ marginLeft: 'auto', fontSize: '14px' }}>🎤</span>
        </div>

        {/* Remote users */}
        {Object.entries(remoteStreams).map(([socketId, stream]) => {
          const remoteUser = remoteUsers[socketId];
          const userId = remoteUser?.userId;
          const socketUsername = remoteUser?.username;
          const remoteMuted = remoteUser?.isMuted;
          const remoteDeafened = remoteUser?.isDeafened;
          
          const profile = serverProfiles.find(p => p.userId === userId);

          const name = profile?.serverSpecificName || profile?.username || socketUsername || 'Unknown';
          
          return (
            <div key={socketId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
              <div style={{
                position: 'relative',
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#4e5058', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'white',
              }}>
                {name[0]?.toUpperCase() || '?'}
                {/* Status badge - bottom right corner */}
                {renderStatusBadge(remoteMuted, remoteDeafened) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    background: '#232428',
                    borderRadius: '50%',
                    padding: '1px',
                  }}>
                    {renderStatusBadge(remoteMuted, remoteDeafened)}
                  </div>
                )}
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