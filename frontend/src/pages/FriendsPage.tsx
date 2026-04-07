import { useEffect, useMemo, useState } from 'react';
import './FriendsPage.css';
import { buildPath } from '../utils/config';

const FriendsPage = () => {
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const userId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed.id || parsed.userId || '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    const loadFriends = async () => {
      if (!userId) {
        setError('No user logged in.');
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(buildPath(`api/users/${userId}/friends`));
        const payload = await response.json();

        if (!response.ok || payload.error) {
          setError(payload.error || 'Unable to load friends.');
          setFriends([]);
        } else {
          setFriends(payload.friends || []);
        }
      } catch (err: any) {
        setError(err?.toString?.() || 'Unable to load friends.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [userId]);

  return (
    <div className="friends-screen">
      <div className="friends-glow" aria-hidden="true" />
      <div className="friends-panel">
        <header className="friends-topbar">
          <div className="friends-topbar-left">
            <div className="friends-topbar-title">
              <span className="friends-title-icon" aria-hidden="true">
                F
              </span>
              <span className="friends-title-text">Friends</span>
            </div>
            <span className="friends-topbar-sep" aria-hidden="true">
              •
            </span>
            <nav className="friends-topbar-tabs" aria-label="Friends tabs">
              <button className="friends-tab friends-tab-active" type="button">
                Online
              </button>
              <button className="friends-tab" type="button">
                All
              </button>
            </nav>
          </div>
          <button className="friends-addfriend" type="button">
            Add Friend
          </button>
        </header>

        <section className="friends-controls">
          <input
            className="friends-search"
            placeholder="Search friends"
            aria-label="Search friends"
          />
          <button className="friends-action" type="button">
            New chat
          </button>
        </section>

        <section className="friends-list" aria-label="Friends list">
          {isLoading && <div className="friends-empty">Loading friends...</div>}
          {!isLoading && error && (
            <div className="friends-empty">{error}</div>
          )}
          {!isLoading && !error && friends.length === 0 && (
            <div className="friends-empty">
              <p>No friends yet.</p>
              <span>Once you add friends, they will show up here.</span>
            </div>
          )}
          {!isLoading && !error &&
            friends.map((friend) => (
              <article className="friend-card" key={friend._id}>
                <div className="friend-avatar">
                  {friend.profilePicture ? (
                    <img src={friend.profilePicture} alt={friend.username} />
                  ) : (
                    <span>{(friend.username || '?')[0]}</span>
                  )}
                </div>
                <div className="friend-meta">
                  <h2>{friend.username || 'Unknown user'}</h2>
                  <p>Available</p>
                </div>
                <div className="friend-actions">
                  <button className="friends-icon" type="button">
                    Message
                  </button>
                  <button className="friends-icon" type="button">
                    Call
                  </button>
                </div>
              </article>
            ))}
        </section>
      </div>
    </div>
  );
};

export default FriendsPage;
