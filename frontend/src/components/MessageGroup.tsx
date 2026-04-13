import React, { useState, useRef, useEffect } from 'react';
import './MessageGroup.css';
import type { ChatMessage } from '../hooks/useFriendsChat';

interface MessageGroupProps {
  senderUsername: string;
  senderAvatar?: string;
  messages: ChatMessage[];
  isOwn: boolean;
  onEditMessage: (messageId: string, newContent: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<boolean>;
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  messageId?: string;
}

interface EditingState {
  active: boolean;
  messageId?: string;
  originalContent: string;
  newContent: string;
}

interface ConfirmDialog {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const MessageGroup: React.FC<MessageGroupProps> = ({
  senderUsername,
  senderAvatar,
  messages,
  isOwn,
  onEditMessage,
  onDeleteMessage,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0 });
  const [editingState, setEditingState] = useState<EditingState>({ active: false, originalContent: '', newContent: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      messageId,
    });
  };

  const handleEditClick = () => {
    const message = messages.find(m => m._id === contextMenu.messageId);
    if (message) {
      setEditingState({
        active: true,
        messageId: contextMenu.messageId,
        originalContent: message.message,
        newContent: message.message,
      });
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };

  const handleDeleteClick = async () => {
    if (!contextMenu.messageId) return;

    setConfirmDialog({
      visible: true,
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      onConfirm: async () => {
        setIsProcessing(true);
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        
        const success = await onDeleteMessage(contextMenu.messageId!);
        setIsProcessing(false);
        
        if (!success) {
          alert('Failed to delete message');
        }
        setContextMenu({ visible: false, x: 0, y: 0 });
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editingState.messageId || !editingState.newContent.trim()) return;
    if (editingState.newContent === editingState.originalContent) {
      setEditingState({ active: false, originalContent: '', newContent: '' });
      return;
    }

    console.log('Saving edit:', { messageId: editingState.messageId, newContent: editingState.newContent });
    
    setIsProcessing(true);
    const success = await onEditMessage(editingState.messageId, editingState.newContent);
    setIsProcessing(false);

    console.log('Edit result:', success);

    if (!success) {
      alert('Failed to edit message');
    } else {
      setEditingState({ active: false, originalContent: '', newContent: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditingState({ active: false, originalContent: '', newContent: '' });
  };

  return (
    <div className={`message-group ${isOwn ? 'message-group-own' : 'message-group-other'}`} ref={containerRef}>
      {/* Avatar - show for all messages */}
      <div className="message-group-avatar">
        {senderAvatar ? (
          <img src={senderAvatar} alt={senderUsername} />
        ) : (
          <span>{(senderUsername || '?')[0]}</span>
        )}
      </div>

      {/* Messages in Group */}
      <div className="message-group-messages">
        {messages.map((msg, idx) => (
          <div
            key={msg._id || idx}
            className={`message ${isOwn ? 'message-sent' : 'message-received'}`}
            onContextMenu={(e) => isOwn && handleContextMenu(e, msg._id || '')}
          >
            {/* Username and Time Header - only on first message */}
            {idx === 0 && (
              <div className="message-header">
                <span className="message-username">
                  {senderUsername === '[Deleted User]' ? '(deleted)' : senderUsername}
                </span>
                <span className="message-time">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            )}

            {/* Edit Mode */}
            {editingState.active && editingState.messageId === msg._id ? (
              <div className="message-edit-mode">
                <textarea
                  className="message-edit-input"
                  value={editingState.newContent}
                  onChange={(e) => setEditingState({ ...editingState, newContent: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                  disabled={isProcessing}
                />
                <div className="message-edit-actions">
                  <button
                    className="message-edit-save"
                    onClick={handleSaveEdit}
                    disabled={isProcessing || !editingState.newContent.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="message-edit-cancel"
                    onClick={handleCancelEdit}
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Message Content */}
                <div className="message-content">
                  {msg.metadata?.type === 'serverInvite' && msg.metadata.linkCode ? (
                    <div className="message-server-invite">
                      <p className="invite-text">{msg.message}</p>
                      <a 
                        href={`/join/${msg.metadata.linkCode}`} 
                        className="invite-button"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/join/${msg.metadata?.linkCode}`;
                        }}
                      >
                        Join Server
                      </a>
                    </div>
                  ) : (
                    <>
                      {msg.message}
                      {msg.edited && <span className="message-edited">(edited)</span>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && isOwn && (
        <div
          className="message-context-menu"
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
        >
          <button className="context-menu-item" onClick={handleEditClick} disabled={isProcessing}>
            Edit
          </button>
          <button className="context-menu-item context-menu-delete" onClick={handleDeleteClick} disabled={isProcessing}>
            Delete
          </button>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.visible && (
        <div className="confirmation-dialog-overlay">
          <div className="confirmation-dialog">
            <h3 className="confirmation-title">{confirmDialog.title}</h3>
            <p className="confirmation-message">{confirmDialog.message}</p>
            <div className="confirmation-actions">
              <button
                className="confirmation-btn confirmation-confirm"
                onClick={confirmDialog.onConfirm}
                disabled={isProcessing}
              >
                Confirm
              </button>
              <button
                className="confirmation-btn confirmation-cancel"
                onClick={confirmDialog.onCancel}
                disabled={isProcessing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageGroup;
