import { useState, useRef, useEffect, useMemo } from 'react';
import './FriendsPage.css';
import { useFriendsChat } from '../hooks/useFriendsChat';
import AddFriendModal from '../components/AddFriendModal';
import MessageGroup from '../components/MessageGroup';
import { groupMessagesByUser } from '../utils/messageGrouping';

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
    addFriend,
    editMessage,
    deleteMessage,
  } = useFriendsChat();

  const [messageInput, setMessageInput] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages by sender for continuous chat display
  const messageGroups = useMemo(() => {
    return groupMessagesByUser(messages);
  }, [messages]);

  const handleSendMessage = async () => {
    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput('');
    }
  };

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
            <button 
              className="friends-action" 
              type="button"
              onClick={() => setShowAddFriendModal(true)}
            >
              Add Friend
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
                  messageGroups.map((group, idx) => {
                    const isOwn = group.senderId === userId;
                    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
                    const senderUsername = isOwn
                      ? (userData.username || 'You')
                      : (selectedFriend?.username || 'Unknown');
                    const senderAvatar = isOwn
                      ? userData.profilePicture
                      : selectedFriend?.profilePicture;

                    return (
                      <MessageGroup
                        key={idx}
                        senderUsername={senderUsername}
                        senderAvatar={senderAvatar}
                        messages={group.messages}
                        isOwn={isOwn}
                        userId={userId}
                        onEditMessage={editMessage}
                        onDeleteMessage={deleteMessage}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-area">
                <textarea
                  className="message-input"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                      e.preventDefault();
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

      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onAddFriend={handleAddFriend}
        isLoading={isAddingFriend}
      />
    </div>
  );
};

export default FriendsPage;
