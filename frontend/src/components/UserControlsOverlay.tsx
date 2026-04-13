import { useState, useEffect, useMemo } from 'react';
import './UserControlsOverlay.css';
import { authFetch } from '../utils/authFetch';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface UserControlsOverlayProps {
  onClose: () => void;
  isServerPage?: boolean;
  serverId?: string;
  onProfileUpdate?: () => void;
}

type TabType = 'account' | 'server';

const UserControlsOverlay = ({ onClose, isServerPage = false, serverId, onProfileUpdate }: UserControlsOverlayProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [selectedProfilePicture, setSelectedProfilePicture] = useState<string>('');
  const [selectedServerPicture, setSelectedServerPicture] = useState<string>('');
  const [serverDisplayName, setServerDisplayName] = useState<string>('');
  const [loadingProfilePicture, setLoadingProfilePicture] = useState(false);
  const [loadingServerProfile, setLoadingServerProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const availableAvatars = ['/avatars/dog.png', '/avatars/juan.png'];

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

  // Initialize profile pictures from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        const picture = parsed.profilePicture || '';
        setSelectedProfilePicture(normalizeProfilePicturePath(picture));
      }

      if (isServerPage && serverId) {
        const serverProfileKey = `serverProfile_${serverId}`;
        const serverProfileRaw = localStorage.getItem(serverProfileKey);
        if (serverProfileRaw) {
          const serverProfile = JSON.parse(serverProfileRaw);
          setServerDisplayName(serverProfile.serverSpecificName || '');
          setSelectedServerPicture(serverProfile.serverProfilePicture || normalizeProfilePicturePath(availableAvatars[0]));
        }
      }
    } catch (e) {
      // Fail silently on parse errors
    }
  }, [isServerPage, serverId]);

  const handleSelectProfilePicture = async (avatar: string) => {
    setSelectedProfilePicture(avatar);
    setError('');
    setSuccess('');

    // Auto-save global profile picture
    setLoadingProfilePicture(true);
    try {
      const filename = avatar.split('/').pop() || avatar;
      const response = await authFetch('api/profile/updateProfilePicture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: filename }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update profile picture');

      // Update localStorage
      const raw = localStorage.getItem('user_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.profilePicture = filename;
        localStorage.setItem('user_data', JSON.stringify(parsed));
      }

      setSuccess('Profile picture updated!');
      setTimeout(() => setSuccess(''), 2000);
      
      // Notify parent component to refresh server profiles cache if on server page
      if (isServerPage) {
        onProfileUpdate?.();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile picture');
    } finally {
      setLoadingProfilePicture(false);
    }
  };

  const handleSelectServerPicture = (avatar: string) => {
    setSelectedServerPicture(avatar);
    setError('');
  };

  const handleSaveServerProfile = async () => {
    if (!serverId || !userId) {
      setError('Server or user information missing');
      return;
    }

    setLoadingServerProfile(true);
    setError('');
    setSuccess('');

    try {
      const filename = selectedServerPicture.split('/').pop() || selectedServerPicture;
      const response = await authFetch(`api/servers/${serverId}/profile/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverSpecificName: serverDisplayName,
          serverProfilePicture: filename,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update server profile');

      // Update localStorage
      const serverProfileKey = `serverProfile_${serverId}`;
      localStorage.setItem(
        serverProfileKey,
        JSON.stringify({
          serverSpecificName: serverDisplayName,
          serverProfilePicture: filename,
        })
      );

      setSuccess('Server profile updated!');
      setTimeout(() => setSuccess(''), 2000);
      
      // Notify parent component to refresh server profiles cache
      onProfileUpdate?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update server profile');
    } finally {
      setLoadingServerProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setError('');

    try {
      const response = await authFetch(`api/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Clear localStorage and redirect to login
      localStorage.clear();
      window.location.href = '/login';
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="user-controls-overlay" onClick={onClose}>
      <div className="user-controls-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-controls-modal-header">
          <h2>Settings</h2>
          <button className="user-controls-modal-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="user-controls-modal-body">
          <div className="settings-tabs">
            <div className="tab-bar">
              <button
                className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                Account Settings
              </button>
              {isServerPage && (
                <button
                  className={`tab-button ${activeTab === 'server' ? 'active' : ''}`}
                  onClick={() => setActiveTab('server')}
                >
                  Server Profile
                </button>
              )}
            </div>

            <div className="tab-content">
              {/* Account Settings Tab */}
              {activeTab === 'account' && (
                <div className="settings-panel">
                  <h3>Profile Picture</h3>
                  <div className="avatar-grid">
                    {availableAvatars.map((avatar) => (
                      <button
                        key={avatar}
                        className={`avatar-option ${selectedProfilePicture === normalizeProfilePicturePath(avatar) ? 'selected' : ''}`}
                        onClick={() => handleSelectProfilePicture(normalizeProfilePicturePath(avatar))}
                        disabled={loadingProfilePicture}
                      >
                        <img src={normalizeProfilePicturePath(avatar)} alt="Avatar option" />
                        {selectedProfilePicture === normalizeProfilePicturePath(avatar) && (
                          <div className="checkmark">✓</div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="danger-zone">
                    <h3>Danger Zone</h3>
                    <button
                      className="delete-button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeletingAccount}
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {/* Server Profile Tab */}
              {activeTab === 'server' && isServerPage && (
                <div className="settings-panel">
                  <h3>Server Display Name</h3>
                  <input
                    type="text"
                    className="display-name-input"
                    value={serverDisplayName}
                    onChange={(e) => {
                      setServerDisplayName(e.target.value.slice(0, 32));
                      setError('');
                    }}
                    placeholder="Your name in this server"
                    maxLength={32}
                  />

                  <h3>Server Profile Picture</h3>
                  <div className="avatar-grid">
                    {availableAvatars.map((avatar) => (
                      <button
                        key={avatar}
                        className={`avatar-option ${selectedServerPicture === normalizeProfilePicturePath(avatar) ? 'selected' : ''}`}
                        onClick={() => handleSelectServerPicture(normalizeProfilePicturePath(avatar))}
                      >
                        <img src={normalizeProfilePicturePath(avatar)} alt="Avatar option" />
                        {selectedServerPicture === normalizeProfilePicturePath(avatar) && (
                          <div className="checkmark">✓</div>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    className="save-button"
                    onClick={handleSaveServerProfile}
                    disabled={loadingServerProfile}
                  >
                    {loadingServerProfile ? 'Saving...' : 'Save Server Profile'}
                  </button>
                </div>
              )}

              {/* Error and Success Messages */}
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="confirmation-overlay" onClick={() => !isDeletingAccount && setShowDeleteConfirm(false)}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Account?</h3>
            <p>This action cannot be undone. All your data will be permanently deleted.</p>
            <div className="confirmation-buttons">
              <button
                className="cancel-button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserControlsOverlay;
