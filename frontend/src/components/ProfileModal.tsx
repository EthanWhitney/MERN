import { useState, useEffect, useMemo } from 'react';
import './ProfileModal.css';
import { authFetch } from '../utils/authFetch';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfilePictureUpdated?: () => void;
}

const ProfileModal = ({ isOpen, onClose, onProfilePictureUpdated }: ProfileModalProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableAvatars] = useState<string[]>([
    '/avatars/dog.png',
    '/avatars/juan.png',
  ]);

  const userId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed.id || parsed.userId || '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    // Load current profile picture when modal opens
    if (isOpen) {
      const raw = localStorage.getItem('user_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        const picture = parsed.profilePicture || '';
        // Normalize: if it's just a filename, convert to full path
        const normalizedPicture = normalizeProfilePicturePath(picture);
        setSelectedAvatar(normalizedPicture);
      }
    }
  }, [isOpen]);

  const handleSelectAvatar = (avatar: string) => {
    setSelectedAvatar(avatar);
    setError('');
    setSuccess('');
  };

  const handleSaveProfilePicture = async () => {
    if (!userId || !selectedAvatar) {
      setError('Please select an avatar');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Extract just the filename from the path (e.g., "/avatars/dog.png" -> "dog.png")
      const filename = selectedAvatar.split('/').pop() || selectedAvatar;

      const response = await authFetch('/api/profile/updateProfilePicture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profilePicture: filename,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile picture');
      }

      // Update localStorage with new profile picture
      const raw = localStorage.getItem('user_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.profilePicture = selectedAvatar;
        localStorage.setItem('user_data', JSON.stringify(parsed));
      }

      setSuccess('Profile picture updated!');
      if (onProfilePictureUpdated) {
        onProfilePictureUpdated();
      }

      // Close modal after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <header className="profile-modal-header">
          <h2>Select Profile Picture</h2>
          <button className="profile-modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </header>

        <div className="profile-modal-content">
          <div className="avatars-grid">
            {availableAvatars.map((avatar) => (
              <div
                key={avatar}
                className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                onClick={() => handleSelectAvatar(avatar)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectAvatar(avatar);
                }}
              >
                <img src={avatar} alt={avatar} />
                {selectedAvatar === avatar && <div className="avatar-checkmark">✓</div>}
              </div>
            ))}
          </div>

          {error && <div className="profile-modal-error">{error}</div>}
          {success && <div className="profile-modal-success">{success}</div>}
        </div>

        <footer className="profile-modal-footer">
          <button
            className="profile-modal-cancel"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="profile-modal-save"
            onClick={handleSaveProfilePicture}
            disabled={loading || !selectedAvatar}
            type="button"
          >
            {loading ? 'Saving...' : 'Save Profile Picture'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProfileModal;
