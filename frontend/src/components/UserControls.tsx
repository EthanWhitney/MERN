import { useState, useEffect } from 'react';
import './UserControls.css';
import UserControlsOverlay from './UserControlsOverlay';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';

interface UserControlsProps {
  userId?: string;
  username?: string;
  profilePicture?: string;
  isServerPage?: boolean;
  serverId?: string;
  serverProfiles?: any[];
  onProfileUpdate?: () => void;
}

const UserControls = ({ userId, username, profilePicture, isServerPage = false, serverId, serverProfiles = [], onProfileUpdate }: UserControlsProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [currentProfilePicture, setCurrentProfilePicture] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Initialize user data from props or localStorage, prioritizing server profile cache if on server page
  useEffect(() => {
    try {
      let displayName = '';
      let displayPicture = '';
      let fetchedUserId = currentUserId || userId || '';

      // First, get the current user ID
      if (!fetchedUserId) {
        const raw = localStorage.getItem('user_data');
        if (raw) {
          const parsed = JSON.parse(raw);
          fetchedUserId = parsed.id || parsed.userId || '';
        }
      }

      // If on a server page, prioritize serverProfiles cache
      if (isServerPage && serverId && serverProfiles && serverProfiles.length > 0) {
        const cachedProfile = serverProfiles.find((p: any) => p.userId === fetchedUserId);
        if (cachedProfile) {
          displayName = cachedProfile.serverSpecificName || cachedProfile.username || displayName;
          displayPicture = cachedProfile.serverProfilePicture || cachedProfile.profilePicture || displayPicture;
        }
      }

      // If still no data, check localStorage
      if (!displayName || !displayPicture) {
        const serverProfileKey = `serverProfile_${serverId}`;
        const serverProfileRaw = localStorage.getItem(serverProfileKey);
        if (serverProfileRaw) {
          const serverProfile = JSON.parse(serverProfileRaw);
          displayName = displayName || serverProfile.serverSpecificName || '';
          displayPicture = displayPicture || serverProfile.serverProfilePicture || '';
        }
      }

      // If still no data, use global profile
      if (!displayName || !displayPicture) {
        if (userId && username) {
          displayName = displayName || username;
          displayPicture = displayPicture || (profilePicture || '');
        } else {
          const raw = localStorage.getItem('user_data');
          if (raw) {
            const parsed = JSON.parse(raw);
            displayName = displayName || (parsed.username || 'Unknown');
            displayPicture = displayPicture || (parsed.profilePicture || '');
            if (!fetchedUserId) {
              fetchedUserId = parsed.id || parsed.userId || '';
            }
          }
        }
      }

      setCurrentUserId(fetchedUserId);
      setCurrentUsername(displayName);
      setCurrentProfilePicture(displayPicture);
    } catch {
      // Fail silently
    }
  }, [userId, username, profilePicture, isServerPage, serverId, serverProfiles]);

  // Refresh when settings modal closes, prioritizing server profile cache
  useEffect(() => {
    if (!showSettings) {
      try {
        let displayPicture = '';
        let displayName = '';
        let fetchedUserId = currentUserId;

        // Get current user ID if not set
        if (!fetchedUserId) {
          const raw = localStorage.getItem('user_data');
          if (raw) {
            const parsed = JSON.parse(raw);
            fetchedUserId = parsed.id || parsed.userId || '';
          }
        }

        // If on a server page, prioritize serverProfiles cache
        if (isServerPage && serverId && serverProfiles && serverProfiles.length > 0) {
          const cachedProfile = serverProfiles.find((p: any) => p.userId === fetchedUserId);
          if (cachedProfile) {
            displayName = cachedProfile.serverSpecificName || cachedProfile.username || displayName;
            displayPicture = cachedProfile.serverProfilePicture || cachedProfile.profilePicture || displayPicture;
          }
        }

        // If still no data, check localStorage
        if (!displayName || !displayPicture) {
          const serverProfileKey = `serverProfile_${serverId}`;
          const serverProfileRaw = localStorage.getItem(serverProfileKey);
          if (serverProfileRaw) {
            const serverProfile = JSON.parse(serverProfileRaw);
            displayName = displayName || (serverProfile.serverSpecificName || '');
            displayPicture = displayPicture || (serverProfile.serverProfilePicture || '');
          }
        }

        // If still no data, use global profile
        if (!displayName || !displayPicture) {
          const raw = localStorage.getItem('user_data');
          if (raw) {
            const parsed = JSON.parse(raw);
            displayName = displayName || (parsed.username || '');
            displayPicture = displayPicture || (parsed.profilePicture || '');
          }
        }

        if (displayName) setCurrentUsername(displayName);
        if (displayPicture) setCurrentProfilePicture(displayPicture);
      } catch {
        // Fail silently
      }
    }
  }, [showSettings, isServerPage, serverId, serverProfiles, currentUserId]);

  const displayPicture = normalizeProfilePicturePath(currentProfilePicture);

  return (
    <div className="user-controls">
      <div className="user-controls-left">
        <div className="user-controls-avatar">
          {displayPicture ? (
            <img src={displayPicture} alt={currentUsername} />
          ) : (
            <span>{(currentUsername || '?')[0]}</span>
          )}
        </div>
        <span className="user-controls-username">{currentUsername}</span>
      </div>

      <div className="user-controls-buttons">
        <button
          className="user-controls-btn user-controls-settings"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.67 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.25 5.35 19.01 5.28 18.81 5.38L16.53 6.62C16.04 6.23 15.5 5.92 14.92 5.71L14.6 3.09C14.57 2.86 14.38 2.69 14.15 2.69H10.85C10.62 2.69 10.43 2.86 10.4 3.09L10.08 5.71C9.5 5.92 8.96 6.23 8.47 6.62L6.19 5.38C5.99 5.28 5.75 5.35 5.64 5.55L3.72 8.87C3.61 9.07 3.66 9.34 3.84 9.48L5.87 11.06C5.82 11.36 5.8 11.67 5.8 12C5.8 12.33 5.82 12.64 5.87 12.94L3.84 14.52C3.66 14.66 3.61 14.93 3.72 15.13L5.64 18.45C5.75 18.65 5.99 18.72 6.19 18.62L8.47 17.38C8.96 17.77 9.5 18.08 10.08 18.29L10.4 20.91C10.43 21.14 10.62 21.31 10.85 21.31H14.15C14.38 21.31 14.57 21.14 14.6 20.91L14.92 18.29C15.5 18.08 16.04 17.77 16.53 17.38L18.81 18.62C19.01 18.72 19.25 18.65 19.36 18.45L21.28 15.13C21.39 14.93 21.34 14.66 21.16 14.52L19.14 12.94ZM12.5 15.5C11.04 15.5 9.8 14.26 9.8 12.8C9.8 11.34 11.04 10.1 12.5 10.1C13.96 10.1 15.2 11.34 15.2 12.8C15.2 14.26 13.96 15.5 12.5 15.5Z" />
          </svg>
        </button>
      </div>

      {showSettings && <UserControlsOverlay onClose={() => setShowSettings(false)} isServerPage={isServerPage} serverId={serverId} onProfileUpdate={onProfileUpdate} />}
    </div>
  );
};

export default UserControls;
