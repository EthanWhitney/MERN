import { useEffect, useRef, useState } from 'react';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import { authFetch } from '../utils/authFetch';
import './UserProfilePreview.css';

interface UserProfilePreviewProps {
  userId: string;
  username: string;
  profilePicture: string;
  x: number;
  y: number;
  onClose: () => void;
  onDMClick?: (userId: string) => void;
  currentUserId?: string;
}

type FriendshipStatus = 'friends' | 'pending' | 'not-friends';

const UserProfilePreview = ({ userId, username, profilePicture, x, y, onClose, onDMClick, currentUserId }: UserProfilePreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('not-friends');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Fetch friendship status
  useEffect(() => {
    const checkFriendshipStatus = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Get friends list
        const friendsResponse = await authFetch('api/users/friends');
        if (!friendsResponse.ok) {
          setFriendshipStatus('not-friends');
          return;
        }

        const friendsData = await friendsResponse.json();
        const isFriend = friendsData.friends?.some((friend: any) => friend._id === userId || friend === userId);

        if (isFriend) {
          setFriendshipStatus('friends');
        } else {
          // Check pending requests
          const pendingResponse = await authFetch('api/users/friends/pending');
          if (pendingResponse.ok) {
            const pendingData = await pendingResponse.json();
            const hasPending = pendingData.pending?.some((req: any) => req.from === userId || req.from?._id === userId || req.to === userId || req.to?._id === userId);
            setFriendshipStatus(hasPending ? 'pending' : 'not-friends');
          } else {
            setFriendshipStatus('not-friends');
          }
        }
      } catch (err) {
        setFriendshipStatus('not-friends');
      } finally {
        setIsLoading(false);
      }
    };

    checkFriendshipStatus();
  }, [userId]);

  const handleSendFriendRequest = async () => {
    try {
      setIsActionLoading(true);
      setError('');

      const response = await authFetch(`api/users/friends/${userId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to send friend request');
        return;
      }

      setFriendshipStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDMClick = () => {
    onDMClick?.(userId);
    onClose();
  };

  const normalizedPicture = profilePicture ? normalizeProfilePicturePath(profilePicture) : '';

  return (
    <div className="user-profile-preview-overlay">
      <div
        className="user-profile-preview"
        ref={previewRef}
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <div className="user-profile-preview-content">
          <div className="user-profile-preview-avatar">
            {normalizedPicture ? (
              <img src={normalizedPicture} alt={username} />
            ) : (
              <span>{(username || '?')[0].toUpperCase()}</span>
            )}
          </div>
          <div className="user-profile-preview-info">
            <h3 className="user-profile-preview-username">{username}</h3>
            {error && <p className="user-profile-preview-error">{error}</p>}
          </div>

          {userId !== currentUserId && (
            <div className="user-profile-preview-actions">
              {isLoading ? (
                <button className="user-profile-preview-btn user-profile-preview-btn-loading" disabled>
                  Loading...
                </button>
              ) : friendshipStatus === 'friends' ? (
                <button
                  className="user-profile-preview-btn user-profile-preview-btn-dm"
                  onClick={handleDMClick}
                  disabled={isActionLoading}
                >
                  DM
                </button>
              ) : friendshipStatus === 'pending' ? (
                <button className="user-profile-preview-btn user-profile-preview-btn-pending" disabled>
                  Pending
                </button>
              ) : (
                <button
                  className="user-profile-preview-btn user-profile-preview-btn-friend-request"
                  onClick={handleSendFriendRequest}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? 'Sending...' : 'Friend Request'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePreview;
