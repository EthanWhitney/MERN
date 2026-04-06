import { useEffect, useRef, useState } from 'react';
import './AddFriendModal.css';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFriend: (username: string) => Promise<boolean>;
  isLoading?: boolean;
}

export const AddFriendModal = ({ isOpen, onClose, onAddFriend, isLoading = false }: AddFriendModalProps) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setUsername('');
      setError('');
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddFriend = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      const success = await onAddFriend(username.trim());
      if (success) {
        setUsername('');
        setError('');
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to add friend');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleAddFriend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Friend</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <label htmlFor="friend-username">Enter username:</label>
          <input
            id="friend-username"
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Enter exact username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          {error && <p className="modal-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button
            className="modal-btn modal-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={handleAddFriend}
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? 'Adding...' : 'Add Friend'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
