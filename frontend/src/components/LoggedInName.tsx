import { useState, useMemo } from 'react';
import ProfileModal from './ProfileModal';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import './LoggedInName.css';

function LoggedInName() {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const userData = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [refreshTrigger]);

  function getCurrentUserName() {
    if (!userData) return 'Unknown';
    return (userData.firstName || '') + ' ' + (userData.lastName || '');
  }

  function doLogout(event: any): void {
    event.preventDefault();
    localStorage.removeItem('user_data');
    window.location.href = '/';
  }

  const handleProfilePictureUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const profilePicture = userData?.profilePicture;
  
  // Normalize profile picture path using utility function
  const normalizedProfilePicture = normalizeProfilePicturePath(profilePicture);

  return (
    <>
      <div id="loggedInDiv" className="logged-in-container">
        <div className="user-profile-section">
          <div className="user-avatar-small">
            {normalizedProfilePicture ? (
              <img src={normalizedProfilePicture} alt={getCurrentUserName()} />
            ) : (
              <span>{(getCurrentUserName()[0] || '?').toUpperCase()}</span>
            )}
          </div>
          <div className="user-info">
            <span id="userName">Logged In As {getCurrentUserName()}</span>
            <button
              type="button"
              className="profile-settings-btn"
              onClick={() => setIsProfileModalOpen(true)}
            >
              Edit Profile Picture
            </button>
          </div>
        </div>
        <button
          type="button"
          id="logoutButton"
          className="buttons"
          onClick={doLogout}
        >
          Log Out
        </button>
      </div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfilePictureUpdated={handleProfilePictureUpdated}
      />
    </>
  );
}

export default LoggedInName;