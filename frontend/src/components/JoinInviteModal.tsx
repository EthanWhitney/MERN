import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';
import { buildPath } from '../utils/config';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import './JoinInviteModal.css';

interface JoinInviteModalProps {
  linkCode: string;
  onClose: () => void;
}

const JoinInviteModal = ({ linkCode, onClose }: JoinInviteModalProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<{
    serverId: string;
    serverName: string;
    serverProfilePicture: string;
    memberCount: number;
  } | null>(null);

  // Fetch invite metadata on mount
  useEffect(() => {
    const fetchInviteData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(buildPath(`api/invites/${linkCode}`));
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load invite');
          setInviteData(null);
          return;
        }

        setInviteData({
          serverId: data.serverId,
          serverName: data.serverName,
          serverProfilePicture: data.serverProfilePicture,
          memberCount: data.memberCount,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load invite');
        setInviteData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInviteData();
  }, [linkCode]);

  const handleJoin = async () => {
    if (!inviteData) return;

    try {
      setJoining(true);
      setError('');

      const response = await authFetch(`api/invites/${linkCode}/join`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to join server');
        return;
      }

      // Successfully joined, navigate to server
      navigate(`/chat/server/${inviteData.serverId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join server');
    } finally {
      setJoining(false);
    }
  };

  const serverProfilePicture = inviteData?.serverProfilePicture 
    ? normalizeProfilePicturePath(inviteData.serverProfilePicture)
    : '';

  return (
    <div className="join-invite-modal-overlay" onClick={onClose}>
      <div className="join-invite-modal" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="join-invite-loading">
            <p>Loading invite...</p>
          </div>
        ) : error ? (
          <div className="join-invite-error">
            <p>{error}</p>
            <button className="join-invite-close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : inviteData ? (
          <div className="join-invite-content">
            <div className="join-invite-header">
              <h2>Join Server</h2>
              <button className="join-invite-close" onClick={onClose}>×</button>
            </div>

            <div className="join-invite-body">
              <div className="join-invite-server-icon">
                {serverProfilePicture ? (
                  <img src={serverProfilePicture} alt={inviteData.serverName} />
                ) : (
                  <span>{(inviteData.serverName || '?')[0].toUpperCase()}</span>
                )}
              </div>

              <h3 className="join-invite-server-name">{inviteData.serverName}</h3>
              <p className="join-invite-member-count">
                {inviteData.memberCount} {inviteData.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>

            <div className="join-invite-footer">
              <button
                className="join-invite-btn-cancel"
                onClick={onClose}
                disabled={joining}
              >
                Cancel
              </button>
              <button
                className="join-invite-btn-join"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JoinInviteModal;
