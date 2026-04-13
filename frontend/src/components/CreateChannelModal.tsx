import { useState } from 'react';
import './CreateChannelModal.css';
import { createTextChannel, type Channel } from '../services/serverApi';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
  serverId: string;
  currentUserId: string;
}

const CreateChannelModal = ({ isOpen, onClose, onChannelCreated, serverId, currentUserId }: CreateChannelModalProps) => {
  const [channelName, setChannelName] = useState('');
  const [topic, setTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelName.trim()) {
      setError('Channel name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const newChannel = await createTextChannel(serverId, {
        channelName: channelName.trim(),
        topic: topic.trim(),
        userId: currentUserId,
      });

      onChannelCreated(newChannel);
      setChannelName('');
      setTopic('');
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setChannelName('');
      setTopic('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-channel-modal-overlay" onClick={handleClose}>
      <div className="create-channel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-channel-header">
          <h2>Create Text Channel</h2>
          <p>Create a new channel for your community to chat in.</p>
        </div>

        <form onSubmit={handleSubmit} className="create-channel-form">
          <div className="form-group">
            <label htmlFor="channelName">CHANNEL NAME</label>
            <div className="channel-name-input">
              <span className="hashtag">#</span>
              <input
                id="channelName"
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="new-channel"
                maxLength={100}
                disabled={isCreating}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="topic">CHANNEL TOPIC (OPTIONAL)</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              maxLength={200}
              disabled={isCreating}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={isCreating || !channelName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
