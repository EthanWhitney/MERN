import { useState } from 'react';
import { useFriendsChat } from '../hooks/useFriendsChat';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import AddFriendModal from './AddFriendModal';
import './FriendsPanel.css';
import UserControls from './UserControls';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
  online?: boolean;
}

interface FriendsPanelProps {
  selectedFriend: Friend | null;
  onSelectFriend: (friend: Friend) => void;
  activeTab: 'online' | 'all' | 'requests';
}

const FriendsPanel = ({ selectedFriend, onSelectFriend, activeTab }: FriendsPanelProps) => {
  const {
    friends,
    pendingRequests,
    loading,
    error,
    addFriend,
  } = useFriendsChat();

  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  const handleAddFriend = async (username: string): Promise<boolean> => {
    setIsAddingFriend(true);
    try {
      await addFriend(username);
      return true;
    } catch (err) {
      throw err;
    } finally {
      setIsAddingFriend(false);
    }
  };

  return (
    <div className="friends-panel">
      <header className="friends-topbar">
        <div className="friends-topbar-left">
          <div className="friends-topbar-title">
            <span className="friends-title-icon" aria-hidden="true">
              F
            </span>
            <span className="friends-title-text">Friends</span>
          </div>
        </div>
        <button className="friends-addfriend" type="button" onClick={() => setShowAddFriendModal(true)}>
          Add Friend
        </button>
      </header>

      <section className="friends-controls">
        <input
          className="friends-search"
          placeholder="Search friends"
          aria-label="Search friends"
        />
      </section>

      <section className="friends-list" aria-label="Friends list">
        {loading && <div className="friends-empty">Loading...</div>}
        {!loading && error && (
          <div className="friends-empty">{error}</div>
        )}
        
        {!loading && !error && friends.length === 0 && activeTab !== 'requests' && (
          <div className="friends-empty">
            <p>No friends yet.</p>
            <span>Once you add friends, they will show up here.</span>
          </div>
        )}

        {!loading && !error && activeTab !== 'requests' && friends.length > 0 && (
          <>
            <div style={{ paddingTop: '16px', paddingBottom: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f2f3f5', margin: '0 12px' }}>
                Friends
              </h2>
            </div>
            {friends.map((friend) => (
              <article
                className={`friend-card ${selectedFriend?._id === friend._id ? 'friend-card-active' : ''}`}
                key={friend._id}
                onClick={() => onSelectFriend(friend)}
              >
                <div className="friend-avatar">
                  {friend.profilePicture ? (
                    <img src={normalizeProfilePicturePath(friend.profilePicture)} alt={friend.username} />
                  ) : (
                    <span>{(friend.username || '?')[0]}</span>
                  )}
                </div>
                <div className="friend-meta">
                  <h2>{friend.username || 'Unknown user'}</h2>
                  <p>{friend.online ? 'Online' : 'Offline'}</p>
                </div>
              </article>
            ))}
          </>
        )}

        {!loading && !error && activeTab === 'requests' && (
          <>
            {pendingRequests.length === 0 && friends.length === 0 ? (
              <div className="friends-empty">
                <p>No pending requests.</p>
                <span>Friend requests will appear here.</span>
              </div>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <>
                    {pendingRequests.map((request) => (
                      <article
                        className="friend-card friend-request-card"
                        key={request._id}
                      >
                        <div className="friend-avatar">
                          {request.profilePicture ? (
                            <img src={normalizeProfilePicturePath(request.profilePicture)} alt={request.username} />
                          ) : (
                            <span>{(request.username || '?')[0]}</span>
                          )}
                        </div>
                        <div className="friend-meta">
                          <h2>{request.username || 'Unknown user'}</h2>
                          <p>wants to be friends</p>
                        </div>
                      </article>
                    ))}
                  </>
                )}
                {friends.length > 0 && (
                  <>
                    <div style={{ paddingTop: '16px', borderTop: '1px solid #3f4147' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: '#949ba4', margin: '8px 12px 8px 12px' }}>
                        All Friends
                      </h3>
                    </div>
                    {friends.map((friend) => (
                      <article
                        className={`friend-card ${selectedFriend?._id === friend._id ? 'friend-card-active' : ''}`}
                        key={friend._id}
                        onClick={() => onSelectFriend(friend)}
                      >
                        <div className="friend-avatar">
                          {friend.profilePicture ? (
                            <img src={normalizeProfilePicturePath(friend.profilePicture)} alt={friend.username} />
                          ) : (
                            <span>{(friend.username || '?')[0]}</span>
                          )}
                        </div>
                        <div className="friend-meta">
                          <h2>{friend.username || 'Unknown user'}</h2>
                          <p>{friend.online ? 'Online' : 'Offline'}</p>
                        </div>
                      </article>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </section>

      <UserControls isServerPage={false} />

      {showAddFriendModal && (
        <AddFriendModal
          isOpen={showAddFriendModal}
          onClose={() => setShowAddFriendModal(false)}
          onAddFriend={handleAddFriend}
          isLoading={isAddingFriend}
        />
      )}
    </div>
  );
};

export default FriendsPanel;
