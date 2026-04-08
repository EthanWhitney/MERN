import { useEffect, useMemo, useState, useRef } from 'react';
import './FriendsChat.css';
import { useFriendsChat } from '../hooks/useFriendsChat';
import MessageGroup from './MessageGroup';
import { groupMessagesByUser } from '../utils/messageGrouping';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface FriendsChatProps {
  selectedFriend: Friend | null;
  currentUserId: string;
}

const FriendsChat = ({ selectedFriend, currentUserId }: FriendsChatProps) => {
  const {
    messages,
    loading,
    error,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useFriendsChat(selectedFriend?._id);

  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive current user's username from localStorage
  const currentUsername = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed.username || '';
    } catch {
      return '';
    }
  }, []);

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

  return (
    <div className="chat-area">
      {selectedFriend ? (
        <>
          <header className="chat-header">
            <div className="chat-friend-info">
              <div className="chat-friend-avatar">
                {selectedFriend.profilePicture ? (
                  <img src={selectedFriend.profilePicture} alt={selectedFriend.username} />
                ) : (
                  <span>{(selectedFriend.username || '?')[0]}</span>
                )}
              </div>
              <div className="chat-friend-details">
                <h2>{selectedFriend.username}</h2>
                <p className="chat-friend-status">Active now</p>
              </div>
            </div>
          </header>

          {loading && <p className="muted chat-thread-status">Loading chat...</p>}
          {error && <p className="error-text chat-thread-status">{error}</p>}

          <section className="chat-messages">
            {messageGroups.map((group, index) => {
              const isOwnMessage = group.senderId === currentUserId;
              return (
                <MessageGroup
                  key={`${group.senderId}-${index}`}
                  senderUsername={isOwnMessage ? currentUsername : selectedFriend.username}
                  senderAvatar={isOwnMessage ? undefined : selectedFriend.profilePicture}
                  messages={group.messages}
                  isOwn={isOwnMessage}
                  onEditMessage={editMessage}
                  onDeleteMessage={deleteMessage}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </section>

          <footer className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />
            <button
              className="chat-send"
              onClick={handleSendMessage}
              disabled={isSending || !messageInput.trim()}
            >
              Send
            </button>
          </footer>
        </>
      ) : (
        <div className="chat-empty">
          <p>Select a friend to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default FriendsChat;
