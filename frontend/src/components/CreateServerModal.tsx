import { useState } from 'react';
import './CreateServerModal.css';
import { createServer, type Server } from '../services/serverApi';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: (server: Server) => void;
}

const CreateServerModal = ({ isOpen, onClose, onServerCreated }: CreateServerModalProps) => {
  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverName.trim()) {
      setError('Server name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const newServer = await createServer({
        serverName: serverName.trim(),
        description: description.trim(),
      });

      onServerCreated(newServer);
      setServerName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setServerName('');
      setDescription('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-server-modal-overlay" onClick={handleClose}>
      <div className="create-server-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-server-header">
          <h2>Create Your Server</h2>
          <p>Give your new server a personality with a name. You can always change it later.</p>
        </div>

        <form onSubmit={handleSubmit} className="create-server-form">
          <div className="form-group">
            <label htmlFor="serverName">SERVER NAME</label>
            <input
              id="serverName"
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Enter server name"
              maxLength={100}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">DESCRIPTION (OPTIONAL)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your server about?"
              maxLength={500}
              rows={3}
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
              disabled={isCreating || !serverName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal;
