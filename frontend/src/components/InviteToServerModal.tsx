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
  const [serverMembers, setServerMembers] = useState<Set<string>>(new Set());
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriendsAndMembers();
    }
  }, [isOpen]);

  const loadFriendsAndMembers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [friendsResponse, membersResponse] = await Promise.all([
        authFetch('api/users/friends'),
        authFetch(`api/servers/${serverId}/members`),
      ]);

      if (friendsResponse.ok) {
        const data = await friendsResponse.json();
        setFriends(data.friends || []);
      } else {
        setError('Failed to load friends');
      }

      if (membersResponse.ok) {
        const data = await membersResponse.json();
        const memberIds = new Set<string>(
          (data.members || []).map((m: any) => (typeof m === 'string' ? m : m._id))
        );
        setServerMembers(memberIds);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (friend: Friend) => {
    try {
      setInvitingUserId(friend._id);
      setError('');

      // Create a personal invite for this user
      const inviteResponse = await authFetch(`api/servers/${serverId}/personal-invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientUserId: friend._id }),
      });

      if (inviteResponse.ok) {
        const inviteData = await inviteResponse.json();
        const linkCode = inviteData.linkCode;
        
        // Send a DM with the invite link using the REST API with metadata
        const inviteMessage = `${friend.username}, you've been invited to join ${serverName}!`;
        
        const dmResponse = await authFetch(`api/chat/dms/${friend._id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: inviteMessage,
            metadata: {
              type: 'serverInvite',
              serverName,
              linkCode,
            },
          }),
        });

        if (dmResponse.ok) {
          setInvitedUsers(prev => new Set([...prev, friend._id]));
          if (onInviteSent) {
            onInviteSent();
          }
        } else {
          console.error('Failed to send DM, but invite was created');
        }
      } else {
        const data = await inviteResponse.json();
        if (data.error?.includes('already a member')) {
          setError(`${friend.username} is already a member of this server`);
        } else {
          setError(data.error || 'Failed to create invite');
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
      const username = userData.user?.username;

      if (!userId) {
        setError('User not found');
        return;
      }

      // Create a personal invite for this user
      const inviteResponse = await authFetch(`api/servers/${serverId}/personal-invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientUserId: userId }),
      });

      if (inviteResponse.ok) {
        const inviteData = await inviteResponse.json();
        const linkCode = inviteData.linkCode;
        
        // Send a DM with the invite link using the REST API with metadata
        const inviteMessage = `${username}, you've been invited to join ${serverName}!`;
        
        const dmResponse = await authFetch(`api/chat/dms/${userId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: inviteMessage,
            metadata: {
              type: 'serverInvite',
              serverName,
              linkCode,
            },
          }),
        });

        if (dmResponse.ok) {
          setInvitedUsers(prev => new Set([...prev, userId]));
          setSearchQuery('');
          if (onInviteSent) {
            onInviteSent();
          }
        } else {
          console.error('Failed to send DM, but invite was created');
          setSearchQuery('');
        }
      } else {
        const data = await inviteResponse.json();
        if (data.error?.includes('already a member')) {
          setError(`${searchQuery} is already a member of this server`);
        } else {
          setError(data.error || 'Failed to create invite');
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
              {filteredFriends.map((friend) => {
                const isAlreadyMember = serverMembers.has(friend._id);
                const isInvited = invitedUsers.has(friend._id);
                const isInviting = invitingUserId === friend._id;

                return (
                  <div 
                    key={friend._id} 
                    className={`invite-friend-item ${isAlreadyMember ? 'already-member' : ''}`}
                  >
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
                      disabled={isAlreadyMember || isInvited || isInviting}
                    >
                      {isAlreadyMember 
                        ? 'Already Member' 
                        : isInvited 
                        ? 'Sent' 
                        : isInviting 
                        ? 'Inviting...' 
                        : 'Invite'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteToServerModal;
