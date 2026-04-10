import { useState, useEffect } from 'react';
import './InviteToServerModal.css';
import { authFetch } from '../utils/authFetch';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface InviteToServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  onInviteSent?: () => void;
}

const InviteToServerModal = ({ isOpen, onClose, serverId, serverName, onInviteSent }: InviteToServerModalProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await authFetch('api/users/friends');
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      } else {
        setError('Failed to load friends');
      }
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (friend: Friend) => {
    try {
      setInvitingUserId(friend._id);
      setError('');

      const response = await authFetch(`api/servers/${serverId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: friend._id }),
      });

      if (response.ok) {
        alert(`${friend.username} has been added to ${serverName}!`);
        if (onInviteSent) {
          onInviteSent();
        }
      } else {
        const data = await response.json();
        if (data.error?.includes('already a member')) {
          setError(`${friend.username} is already a member of this server`);
        } else {
          setError(data.error || 'Failed to invite user');
        }
      }
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setInvitingUserId(null);
    }
  };

  const handleSearchInvite = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // First, get the user by username
      const userResponse = await authFetch(`api/users/search?username=${encodeURIComponent(searchQuery.trim())}`);
      
      if (!userResponse.ok) {
        setError('User not found');
        return;
      }

      const userData = await userResponse.json();
      const userId = userData.user?._id;

      if (!userId) {
        setError('User not found');
        return;
      }

      // Then invite them to the server
      const inviteResponse = await authFetch(`api/servers/${serverId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (inviteResponse.ok) {
        alert(`${searchQuery} has been added to ${serverName}!`);
        setSearchQuery('');
        if (onInviteSent) {
          onInviteSent();
        }
      } else {
        const data = await inviteResponse.json();
        if (data.error?.includes('already a member')) {
          setError(`${searchQuery} is already a member of this server`);
        } else {
          setError(data.error || 'Failed to invite user');
        }
      }
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invite-modal-header">
          <h2>Invite Friends to {serverName}</h2>
          <button className="invite-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="invite-modal-body">
          <div className="invite-search-section">
            <label htmlFor="invite-search">Search by username</label>
            <div className="invite-search-input-group">
              <input
                id="invite-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchInvite();
                  }
                }}
                placeholder="Enter username"
                className="invite-search-input"
              />
              <button 
                className="invite-search-btn"
                onClick={handleSearchInvite}
                disabled={loading || !searchQuery.trim()}
              >
                Invite
              </button>
            </div>
          </div>

          {error && <div className="invite-error">{error}</div>}

          <div className="invite-friends-section">
            <h3>Your Friends</h3>
            {loading && <p className="invite-loading">Loading friends...</p>}
            {!loading && filteredFriends.length === 0 && (
              <p className="invite-empty">
                {searchQuery ? 'No friends match your search' : 'No friends to invite'}
              </p>
            )}
            <div className="invite-friends-list">
              {filteredFriends.map((friend) => (
                <div key={friend._id} className="invite-friend-item">
                  <div className="invite-friend-info">
                    <div className="invite-friend-avatar">
                      {friend.profilePicture ? (
                        <img 
                          src={normalizeProfilePicturePath(friend.profilePicture)} 
                          alt={friend.username}
                        />
                      ) : (
                        <div className="invite-friend-avatar-fallback">
                          {friend.username[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="invite-friend-name">{friend.username}</span>
                  </div>
                  <button
                    className="invite-friend-btn"
                    onClick={() => handleInvite(friend)}
                    disabled={invitingUserId === friend._id}
                  >
                    {invitingUserId === friend._id ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteToServerModal;
