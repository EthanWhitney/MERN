import { useEffect, useMemo, useState, useRef } from 'react';
import './FriendsChat.css';
import { useFriendsChat } from '../hooks/useFriendsChat';
import MessageGroup from './MessageGroup';
import { groupMessagesByUser } from '../utils/messageGrouping';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface FriendsChatProps {
  selectedFriend: Friend | null;
  currentUserId: string;
  activeTab: 'online' | 'all' | 'requests';
}

const FriendsChat = ({ selectedFriend, currentUserId, activeTab }: FriendsChatProps) => {
  const {
    messages,
    loading,
    error,
    isSending,
    isLoadingMore,
    allMessagesLoaded,
    sendMessage,
    editMessage,
    deleteMessage,
    pendingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    loadMoreMessages,
  } = useFriendsChat(selectedFriend?._id);

  const [messageInput, setMessageInput] = useState('');
  const [showTopPopup, setShowTopPopup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const shouldPreserveScrollRef = useRef<boolean>(false);

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

  // Auto-scroll to bottom when messages change (but not when loading more)
  useEffect(() => {
    if (isLoadingMore) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingMore]);

  // Track scroll position when loading more messages to restore it after render
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;

    // When starting to load more messages, save scroll height
    if (isLoadingMore && !shouldPreserveScrollRef.current) {
      prevScrollHeightRef.current = el.scrollHeight;
      shouldPreserveScrollRef.current = true;
      return;
    }

    // After loading more messages, restore scroll position
    if (!isLoadingMore && shouldPreserveScrollRef.current) {
      const heightDifference = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += heightDifference;
      shouldPreserveScrollRef.current = false;
    }
  }, [isLoadingMore]);

  // Show popup when scrolled to top
  useEffect(() => {
    if (!selectedFriend) {
      return;
    }

    const el = chatMessagesRef.current;
    if (!el) return;

    const handleScroll = () => {
      setShowTopPopup(el.scrollTop === 0);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [selectedFriend]);

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
      {activeTab === 'requests' ? (
        // Friend Requests View
        <section className="requests-area">
          <div className="requests-header">
            <h2>Friend Requests</h2>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="chat-empty">
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {pendingRequests.map((request) => (
                <div key={request._id} className="request-item">
                  <div className="request-avatar">
                    {request.profilePicture ? (
                      <img src={normalizeProfilePicturePath(request.profilePicture)} alt={request.username} />
                    ) : (
                      <span>{(request.username || '?')[0]}</span>
                    )}
                  </div>
                  <div className="request-info">
                    <h3>{request.username}</h3>
                  </div>
                  <div className="request-actions">
                    <button
                      className="request-btn request-accept"
                      onClick={async () => {
                        const success = await acceptFriendRequest(request._id);
                        if (!success) {
                          alert('Failed to accept friend request');
                        }
                      }}
                      title="Accept"
                    >
                      ✓
                    </button>
                    <button
                      className="request-btn request-decline"
                      onClick={async () => {
                        const success = await declineFriendRequest(request._id);
                        if (!success) {
                          alert('Failed to decline friend request');
                        }
                      }}
                      title="Decline"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : selectedFriend ? (
        // Chat View
        <>
          <header className="chat-header">
            <div className="chat-friend-info">
              <div className="chat-friend-avatar">
                {selectedFriend.profilePicture ? (
                  <img src={normalizeProfilePicturePath(selectedFriend.profilePicture)} alt={selectedFriend.username} />
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

          {showTopPopup && !allMessagesLoaded && (
            <div 
              className="top-popup"
              onClick={loadMoreMessages}
              style={{ cursor: isLoadingMore ? 'not-allowed' : 'pointer' }}
            >
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </div>
          )}

          <section className="chat-messages" ref={chatMessagesRef}>
            {messageGroups.map((group, index) => {
              const isOwnMessage = group.senderId === currentUserId;
              return (
                <MessageGroup
                  key={`${group.senderId}-${index}`}
                  senderUsername={isOwnMessage ? currentUsername : selectedFriend.username}
                  senderAvatar={isOwnMessage ? undefined : normalizeProfilePicturePath(selectedFriend.profilePicture)}
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
