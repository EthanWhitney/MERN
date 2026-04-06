import { useEffect, useMemo, useState } from 'react';
import './FriendsPage.css';
import { buildPath } from '../utils/config';
import { authFetch } from '../utils/authFetch';

const FriendsPage = () => {
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

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
        const response = await authFetch(buildPath(`api/users/${userId}/friends`));
        
        if (!response.ok) {
          setError('Failed to load friends.');
          setFriends([]);
        } else {
          const payload = await response.json();
          if (payload.error) {
            setError(payload.error);
            setFriends([]);
          } else {
            setFriends(payload.friends || []);
          }
        }
      } catch (err: any) {
        setError(err?.toString?.() || 'Unable to load friends.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [userId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedFriend || !userId) {
        setMessages([]);
        return;
      }

      try {
        const response = await authFetch(
          buildPath(`api/chat/dm/${selectedFriend._id}?limit=50`)
        );

        if (response.ok) {
          const payload = await response.json();
          setMessages(payload.messages || []);
        } else {
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error loading messages:', err);
        setMessages([]);
      }
    };

    loadMessages();
  }, [selectedFriend, userId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedFriend || !userId) return;

    setIsSending(true);
    try {
      const response = await authFetch(
        buildPath(`api/chat/dm/${selectedFriend._id}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageInput }),
        }
      );

      if (response.ok) {
        const payload = await response.json();
        if (payload.message) {
          setMessages([...messages, payload.message]);
          setMessageInput('');
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="friends-screen">
      <div className="friends-glow" aria-hidden="true" />
      <div className="friends-container">
        {/* Left Sidebar */}
        <div className="friends-sidebar">
          <header className="friends-header">
            <h1 className="friends-title">Friends</h1>
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
                <article
                  className={`friend-card ${selectedFriend?._id === friend._id ? 'friend-card-active' : ''}`}
                  key={friend._id}
                  onClick={() => setSelectedFriend(friend)}
                >
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
                </article>
              ))}
          </section>
        </div>

        {/* Right Chat Area */}
        <div className="chat-area">
          {selectedFriend ? (
            <>
              <header className="chat-header">
                <div className="chat-friend-info">
                  <div className="chat-avatar">
                    {selectedFriend.profilePicture ? (
                      <img src={selectedFriend.profilePicture} alt={selectedFriend.username} />
                    ) : (
                      <span>{(selectedFriend.username || '?')[0]}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="chat-friend-name">{selectedFriend.username}</h2>
                    <p className="chat-friend-status">Available</p>
                  </div>
                </div>
              </header>

              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`message ${msg.sender?.userId === userId ? 'message-sent' : 'message-received'}`}
                    >
                      <div className="message-content">{msg.message || msg.content}</div>
                      <span className="message-time">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="message-input-area">
                <input
                  type="text"
                  className="message-input"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isSending) {
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  className="message-send-btn"
                  onClick={handleSendMessage}
                  disabled={isSending || !messageInput.trim()}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <div className="no-friend-selected">
              <p>Select a friend to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
