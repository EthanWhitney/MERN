import './DirectMessagesPage.css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom'; 

type User = {
  _id: string;
  username: string;
};

const DirectMessagesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return; 

      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    };

    fetchUser();
  }, [userId]); 

  return (
    <div className="dm-screen">
      <div className="dm-glow" aria-hidden="true" />
      <div className="dm-phone">
        <header className="dm-header">
          <button className="dm-icon" aria-label="Back to direct messages">
            <span aria-hidden="true">&lt;</span>
          </button>

          <div className="dm-user">
            <div className="dm-avatar" aria-hidden="true">
              {user?.username?.[0]?.toUpperCase() || 'N'}
            </div>
            <div className="dm-user-meta">
              <p className="dm-user-name">{user?.username || 'Loading...'}</p>
              <div className="dm-status">
                <span className="dm-status-dot" aria-hidden="true" />
                Active now
              </div>
            </div>
          </div>

          <div className="dm-header-actions">
            <button className="dm-icon" aria-label="Start voice call">
              <span aria-hidden="true">call</span>
            </button>
            <button className="dm-icon" aria-label="Open settings">
              <span aria-hidden="true">...</span>
            </button>
          </div>
        </header>

        <section className="dm-thread" aria-label="Direct message thread">
          <div className="dm-date">Today</div>
          <div className="dm-empty">
            <p>No messages yet.</p>
            <span>Start the conversation below.</span>
          </div>
        </section>

        <footer className="dm-input">
          <button className="dm-pill" aria-label="Add attachment">
            +
          </button>
          <div className="dm-input-field">
            <span className="dm-input-placeholder">
              Message {user?.username || ''}
            </span>
            <div className="dm-input-actions">
              <button className="dm-icon" aria-label="Add emoji">
                <span aria-hidden="true">:)</span>
              </button>
              <button className="dm-icon" aria-label="Send voice note">
                <span aria-hidden="true">mic</span>
              </button>
            </div>
          </div>
          <button className="dm-send" aria-label="Send message">
            Send
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DirectMessagesPage;