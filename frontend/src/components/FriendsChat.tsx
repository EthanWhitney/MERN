import { useEffect, useMemo, useRef, useState } from 'react';
import { useFriendsChat } from '../hooks/useFriendsChat';
import { groupMessagesByUser } from '../utils/messageGrouping';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import './FriendsChat.css';
import MessageGroup from './MessageGroup';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
  online?: boolean;
}

interface FriendsChatProps {
  selectedFriend: Friend | null;
  currentUserId: string;
  activeTab: 'online' | 'all' | 'requests';
  onTabChange: (tab: 'online' | 'all' | 'requests') => void;
  onSelectFriend?: (friend: Friend) => void;
}

const FriendsChat = ({ selectedFriend, currentUserId, activeTab, onTabChange, onSelectFriend }: FriendsChatProps) => {
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

  // Get friends list from hook
  const { friends } = useFriendsChat();

  return (
    <div className="chat-area">
      <header className="friends-main-header">
        <div className="friends-main-header-left">
          <span className="friends-main-title">Friends</span>
        </div>
        <nav className="friends-main-tabs" aria-label="Friends tabs">
          <button
            className={`friends-main-tab ${activeTab === 'online' ? 'friends-main-tab-active' : ''}`}
            type="button"
            onClick={() => onTabChange('online')}
          >
            Online
          </button>
          <button
            className={`friends-main-tab ${activeTab === 'all' ? 'friends-main-tab-active' : ''}`}
            type="button"
            onClick={() => onTabChange('all')}
          >
            All
          </button>
          <button
            className={`friends-main-tab ${activeTab === 'requests' ? 'friends-main-tab-active' : ''}`}
            type="button"
            onClick={() => onTabChange('requests')}
          >
            Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </button>
        </nav>
      </header>

      {activeTab === 'requests' ? (
        // Friend Requests View
        <section className="requests-area">
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
        // Chat View (shows for both 'all' and 'online' tabs when friend is selected)
        <>
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
      ) : activeTab === 'all' ? (
        // All Friends View
        <section className="all-friends-area">
          {friends.length === 0 ? (
            <div className="chat-empty">
              <p>No friends yet</p>
            </div>
          ) : (
            <div className="all-friends-list">
              {friends.map((friend) => (
                <div
                  key={friend._id}
                  className="friend-item"
                  onClick={() => onSelectFriend?.(friend)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="friend-avatar">
                    {friend.profilePicture ? (
                      <img src={normalizeProfilePicturePath(friend.profilePicture)} alt={friend.username} />
                    ) : (
                      <span>{(friend.username || '?')[0]}</span>
                    )}
                  </div>
                  <div className="friend-info">
                    <h3>{friend.username}</h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : activeTab === 'online' ? (
        // Online Friends View
        <section className="all-friends-area">
          {friends.filter(f => f.online).length === 0 ? (
            <div className="chat-empty">
              <p>No online friends</p>
            </div>
          ) : (
            <div className="all-friends-list">
              {friends.filter(f => f.online).map((friend) => (
                <div
                  key={friend._id}
                  className="friend-item"
                  onClick={() => onSelectFriend?.(friend)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="friend-avatar">
                    {friend.profilePicture ? (
                      <img src={normalizeProfilePicturePath(friend.profilePicture)} alt={friend.username} />
                    ) : (
                      <span>{(friend.username || '?')[0]}</span>
                    )}
                  </div>
                  <div className="friend-info">
                    <h3>{friend.username}</h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="chat-empty">
          <p>Select a friend to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default FriendsChat;
