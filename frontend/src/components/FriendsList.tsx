import { useState } from 'react';
import { useFriendsChat } from '../hooks/useFriendsChat';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import './FriendsList.css';

interface FriendsListProps {
  // onClose callback is available if needed in the future
}

const FriendsList = ({}: FriendsListProps) => {
  const { friends, removeFriend } = useFriendsChat();
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRemoveClick = (friendId: string) => {
    setRemovingFriendId(friendId);
    setError('');
  };

  const handleCancelRemove = () => {
    setRemovingFriendId(null);
    setError('');
  };

  const handleConfirmRemove = async () => {
    if (!removingFriendId) return;

    setRemoving(true);
    setError('');

    try {
      await removeFriend(removingFriendId);
      
      setSuccessMessage('Friend removed successfully');
      setRemovingFriendId(null);
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove friend');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="friends-list-panel">
      <h3>Your Friends</h3>
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {friends.length === 0 ? (
        <div className="no-friends-message">
          <p>You don't have any friends yet. Add some to get started!</p>
        </div>
      ) : (
        <div className="friends-container">
          {friends.map(friend => (
            <div key={friend._id} className="friend-item">
              <div className="friend-info">
                {friend.profilePicture && (
                  <img 
                    src={normalizeProfilePicturePath(friend.profilePicture)} 
                    alt={friend.username}
                    className="friend-avatar"
                  />
                )}
                <div className="friend-details">
                  <div className="friend-username">{friend.username}</div>
                  <div className={`friend-status ${friend.online ? 'online' : 'offline'}`}>
                    {friend.online ? '● Online' : '● Offline'}
                  </div>
                </div>
              </div>
              <button
                className="remove-button"
                onClick={() => handleRemoveClick(friend._id)}
                disabled={removing}
                title="Remove friend"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remove Friend Confirmation Modal */}
      {removingFriendId !== null && (
        <div className="confirmation-overlay" onClick={handleCancelRemove}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Remove Friend?</h3>
            <p>
              Are you sure you want to remove this friend?
            </p>
            <div className="confirmation-buttons">
              <button
                className="cancel-button"
                onClick={handleCancelRemove}
                disabled={removing}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={handleConfirmRemove}
                disabled={removing}
              >
                {removing ? 'Removing...' : 'Remove Friend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsList;
