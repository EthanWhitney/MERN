import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ChatMessage } from '../types/chat';
import UserProfilePreview from './UserProfilePreview';

type MessageListProps = {
  currentUserId: string;
  messages: ChatMessage[];
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<void>;
  allMessagesLoaded?: boolean;
  serverProfiles?: any[];
  onDMClick?: (userId: string) => void;
};

type MenuState = {
  messageId: string;
  x: number;
  y: number;
};

type EditingState = {
  messageId: string;
  content: string;
};

type ProfilePreviewState = {
  userId: string;
  username: string;
  profilePicture: string;
  x: number;
  y: number;
};

const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000;

function MessageList({ currentUserId, messages, onEditMessage, onDeleteMessage, isLoadingMore = false, onLoadMore, allMessagesLoaded = false, serverProfiles = [], onDMClick }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [submittingMessageId, setSubmittingMessageId] = useState('');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showTopPopup, setShowTopPopup] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [profilePreview, setProfilePreview] = useState<ProfilePreviewState | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const shouldPreserveScrollRef = useRef<boolean>(false);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = () => setMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menu]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setHasScrolled(true);
      setShowTopPopup(el.scrollTop === 0);
    };

    el.addEventListener('scroll', handleScroll);
    handleScroll(); // initialize

    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Track scroll position when loading more messages to restore it after render
  useEffect(() => {
    const el = containerRef.current;
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Scroll to bottom if user hasn't scrolled up or this is the initial load
    setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 0);
  }, [messages.length]);

  const getAvatarSrc = (profilePicture?: string): string => {
    if (!profilePicture) {
      return '';
    }

    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://') || profilePicture.startsWith('/')) {
      return profilePicture;
    }

    return `/avatars/${profilePicture}`;
  };

  const getAvatarLabel = (message: ChatMessage): string => {
    const name = message.sender?.serverSpecificName || message.sender?.username || message.senderId || 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  };

  const getDisplayNameFromCache = (message: ChatMessage): string => {
    if (serverProfiles && serverProfiles.length > 0) {
      const senderUserId = message.sender?.userId || message.senderId;
      const cachedProfile = serverProfiles.find((p: any) => p.userId === senderUserId);
      if (cachedProfile?.serverSpecificName) {
        return cachedProfile.serverSpecificName;
      }
      if (cachedProfile?.username) {
        return cachedProfile.username;
      }
    }
    return message.sender?.serverSpecificName || message.sender?.username || message.senderId;
  };

  const getDisplayPictureFromCache = (message: ChatMessage): string => {
    if (serverProfiles && serverProfiles.length > 0) {
      const senderUserId = message.sender?.userId || message.senderId;
      const cachedProfile = serverProfiles.find((p: any) => p.userId === senderUserId);
      if (cachedProfile?.serverProfilePicture) {
        return cachedProfile.serverProfilePicture;
      }
      if (cachedProfile?.profilePicture) {
        return cachedProfile.profilePicture;
      }
    }
    return message.sender?.serverSpecificPFP || message.sender?.profilePicture || '';
  };

  const getGlobalProfile = (message: ChatMessage) => {
    const senderUserId = message.sender?.userId || message.senderId;
    if (serverProfiles && serverProfiles.length > 0) {
      const cachedProfile = serverProfiles.find((p: any) => p.userId === senderUserId);
      if (cachedProfile) {
        return {
          username: cachedProfile.username || 'Unknown',
          profilePicture: cachedProfile.profilePicture || '',
        };
      }
    }
    return {
      username: message.sender?.username || 'Unknown',
      profilePicture: message.sender?.profilePicture || '',
    };
  };

  const handleMessageAuthorClick = (event: React.MouseEvent, message: ChatMessage) => {
    event.stopPropagation();
    const senderUserId = message.sender?.userId || message.senderId;
    const globalProfile = getGlobalProfile(message);
    
    setProfilePreview({
      userId: senderUserId,
      username: globalProfile.username,
      profilePicture: globalProfile.profilePicture,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const isOwnMessage = (message: ChatMessage): boolean => {
    if (!currentUserId) {
      return false;
    }

    const ownerId = message.sender?.userId || message.senderId;
    return ownerId === currentUserId;
  };

  const isWithinMessageEditWindow = (message: ChatMessage): boolean => {
    const createdAtMs = new Date(message.createdAt).getTime();
    if (Number.isNaN(createdAtMs)) {
      return false;
    }

    return (Date.now() - createdAtMs) <= MESSAGE_EDIT_WINDOW_MS;
  };

  const canManageMessage = (message: ChatMessage): boolean => {
    return isOwnMessage(message) && isWithinMessageEditWindow(message);
  };

  const openContextMenu = (event: ReactMouseEvent, message: ChatMessage) => {
    if (!canManageMessage(message)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setMenu({
      messageId: message.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openButtonMenu = (event: ReactMouseEvent<HTMLButtonElement>, messageId: string) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      messageId,
      x: rect.right,
      y: rect.bottom + 4,
    });
  };

  const startEdit = (message: ChatMessage) => {
    if (!canManageMessage(message)) {
      setMenu(null);
      return;
    }

    setMenu(null);
    setEditing({ messageId: message.id, content: message.content });
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const handleEdit = async (message: ChatMessage) => {
    if (!canManageMessage(message)) {
      cancelEdit();
      return;
    }

    const trimmed = (editing?.content || '').trim();
    if (!trimmed || trimmed === message.content) {
      cancelEdit();
      return;
    }

    try {
      setSubmittingMessageId(message.id);
      await onEditMessage(message.id, trimmed);
      cancelEdit();
    } catch (error: any) {
      window.alert(error?.message || 'Failed to edit message');
    } finally {
      setSubmittingMessageId('');
    }
  };

  const handleDelete = async (message: ChatMessage) => {
    if (!canManageMessage(message)) {
      setMenu(null);
      return;
    }

    const confirmed = window.confirm('Delete this message?');
    setMenu(null);
    if (!confirmed) {
      return;
    }

    try {
      setSubmittingMessageId(message.id);
      await onDeleteMessage(message.id);
    } catch (error: any) {
      window.alert(error?.message || 'Failed to delete message');
    } finally {
      setSubmittingMessageId('');
    }
  };

  const selectedMessage = menu ? messages.find((message) => message.id === menu.messageId) : null;

  return (
    <div className="message-list-wrapper">
      {hasScrolled && showTopPopup && !allMessagesLoaded && (
        <div 
          className="top-popup"
          onClick={onLoadMore}
          style={{ cursor: isLoadingMore ? 'not-allowed' : 'pointer' }}
        >
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </div>
      )}

      <div ref={containerRef} className="message-list">
      {messages.length === 0 && <p className="muted message-empty">No messages yet</p>}
      {messages.map((message, index) => {
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const currentSenderKey = message.sender?.userId || message.senderId;
        const previousSenderKey = previousMessage?.sender?.userId || previousMessage?.senderId || '';
        const isContinuation = Boolean(previousMessage) && currentSenderKey === previousSenderKey;
        const canManage = canManageMessage(message);
        const isSubmitting = submittingMessageId === message.id;
        const isEditing = editing?.messageId === message.id;

        return (
        <div
          key={message.id}
          className={`message-row${isContinuation ? ' message-row-continuation' : ''}`}
          onContextMenu={(event) => openContextMenu(event, message)}
        >
          {canManage && (
            <button
              type="button"
              className="message-actions-trigger"
              onClick={(event) => openButtonMenu(event, message.id)}
              disabled={isSubmitting}
              aria-label="Message actions"
            >
              ...
            </button>
          )}

          <div className="message-bubble">
            {!isContinuation && (
              <div className="message-meta" onClick={(e) => handleMessageAuthorClick(e, message)} style={{ cursor: 'pointer' }}>
                <span className="message-inline-avatar" aria-hidden="true">
                  {getDisplayPictureFromCache(message) ? (
                    <img src={getAvatarSrc(getDisplayPictureFromCache(message))} alt="" />
                  ) : (
                    <span>{getAvatarLabel(message)}</span>
                  )}
                </span>
                <span className="message-author">
                  {getDisplayNameFromCache(message)}
                </span>
                <span className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {isEditing ? (
              <div className="message-edit-wrap">
                <input
                  className="message-edit-input"
                  type="text"
                  value={editing?.content || ''}
                  onChange={(event) => setEditing((prev) => {
                    if (!prev || prev.messageId !== message.id) {
                      return prev;
                    }

                    return {
                      ...prev,
                      content: event.target.value,
                    };
                  })}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelEdit();
                    }

                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleEdit(message);
                    }
                  }}
                  autoFocus
                  disabled={isSubmitting}
                />
                <div className="message-edit-actions">
                  <button
                    type="button"
                    className="message-edit-action"
                    onClick={cancelEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="message-edit-action message-edit-action-primary"
                    onClick={() => {
                      void handleEdit(message);
                    }}
                    disabled={isSubmitting || !(editing?.content || '').trim()}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="message-content">{message.content}</p>
            )}
          </div>
        </div>
      );})}

      {menu && selectedMessage && (
        <div
          className="message-context-menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="message-context-action" onClick={() => startEdit(selectedMessage)}>
            Edit
          </button>
          <button type="button" className="message-context-action message-context-action-danger" onClick={() => handleDelete(selectedMessage)}>
            Delete
          </button>
        </div>
      )}

      {profilePreview && (
        <UserProfilePreview
          userId={profilePreview.userId}
          username={profilePreview.username}
          profilePicture={profilePreview.profilePicture}
          x={profilePreview.x}
          y={profilePreview.y}
          onClose={() => setProfilePreview(null)}
          onDMClick={onDMClick}
          currentUserId={currentUserId}
        />
      )}
    </div>
    </div>
  );
}

export default MessageList;
