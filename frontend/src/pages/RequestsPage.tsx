import { useNavigate } from 'react-router-dom';
import './FriendsPage.css';
import { useFriendsChat } from '../hooks/useFriendsChat';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

const RequestsPage = () => {
  const navigate = useNavigate();
  const {
    pendingRequests,
    loading,
    error,
    acceptFriendRequest,
    declineFriendRequest,
  } = useFriendsChat();

  const handleAccept = async (requestId: string) => {
    const success = await acceptFriendRequest(requestId);
    if (!success) {
      alert('Failed to accept friend request');
    }
  };

  const handleDecline = async (requestId: string) => {
    const success = await declineFriendRequest(requestId);
    if (!success) {
      alert('Failed to decline friend request');
    }
  };

  return (
    <div className="friends-screen">
      <div className="friends-glow" aria-hidden="true" />
      
      {/* Back to Friends Panel */}
      <div className="friends-panel">
        <header className="friends-topbar">
          <div className="friends-topbar-left">
            <button 
              className="friends-back-btn"
              type="button"
              onClick={() => navigate('/friends')}
              title="Back to Friends"
              aria-label="Back to Friends"
            >
              ← Friends
            </button>
            <span className="friends-topbar-sep" aria-hidden="true">•</span>
            <div className="friends-topbar-title">
              <span className="friends-title-text">Friend Requests</span>
            </div>
          </div>
        </header>

        <section className="friends-list" aria-label="Friend requests">
          {loading && <div className="friends-empty">Loading...</div>}
          {!loading && error && (
            <div className="friends-empty">{error}</div>
          )}
          
          {!loading && !error && pendingRequests.length === 0 && (
            <div className="friends-empty">
              <p>No pending requests.</p>
              <span>Friend requests will appear here.</span>
            </div>
          )}

          {!loading && !error && pendingRequests.map((request) => (
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
              <div className="request-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  className="request-btn request-accept"
                  onClick={() => handleAccept(request._id)}
                  title="Accept"
                  aria-label={`Accept friend request from ${request.username}`}
                >
                  ✓
                </button>
                <button
                  className="request-btn request-decline"
                  onClick={() => handleDecline(request._id)}
                  title="Decline"
                  aria-label={`Decline friend request from ${request.username}`}
                >
                  ✕
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {/* Empty chat area to match layout */}
      <div className="chat-area">
        <div className="chat-empty">
          <p>Select a friend or manage your requests</p>
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;
