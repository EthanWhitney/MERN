import { useState } from 'react';
import './FriendsPage.css';
import { useFriendsChat } from '../hooks/useFriendsChat';

const FriendsPage = () => {
  const {
    userId,
    friends,
    selectedFriend,
    setSelectedFriend,
    messages,
    loading,
    error,
    isSending,
    sendMessage,
  } = useFriendsChat();

  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = async () => {
    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput('');
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
            {loading && <div className="friends-empty">Loading friends...</div>}
            {!loading && error && (
              <div className="friends-empty">{error}</div>
            )}
            {!loading && !error && friends.length === 0 && (
              <div className="friends-empty">
                <p>No friends yet.</p>
                <span>Once you add friends, they will show up here.</span>
              </div>
            )}
            {!loading && !error &&
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
