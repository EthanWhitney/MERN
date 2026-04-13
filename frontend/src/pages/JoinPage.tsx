import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { retrieveToken } from '../utils/tokenStorage';
import JoinInviteModal from '../components/JoinInviteModal';

const JoinPage = () => {
  const { linkCode } = useParams<{ linkCode: string }>();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const token = retrieveToken();
    if (!token) {
      // Store the current location so user can return after login
      if (linkCode) {
        localStorage.setItem('inviteRedirectPath', `/join/${linkCode}`);
      }
      // Redirect to login if not authenticated
      navigate('/login', { replace: true });
      return;
    }

    // User is authenticated, show the invite modal
    setIsAuthenticated(true);
    setLoading(false);
  }, [navigate, linkCode]);

  const handleClose = () => {
    navigate('/friends', { replace: true });
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ background: '#36393f', minHeight: '100vh' }}>
      {linkCode && (
        <JoinInviteModal linkCode={linkCode} onClose={handleClose} />
      )}
    </div>
  );
};

export default JoinPage;
