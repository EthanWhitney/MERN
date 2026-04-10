import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ServerList.css';
import { getUserServers, type Server } from '../services/serverApi';
import CreateServerModal from './CreateServerModal';

const ServerList = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const userServers = await getUserServers();
      setServers(userServers);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServerClick = (serverId: string) => {
    navigate(`/chat/server/${serverId}`);
  };

  const handleCreateServer = () => {
    setShowCreateModal(true);
  };

  const handleServerCreated = (newServer: Server) => {
    // Check if server already exists before adding (prevent duplicates)
    const exists = servers.some(s => s._id === newServer._id);
    if (!exists) {
      setServers([...servers, newServer]);
    }
    setShowCreateModal(false);
    // Navigate to the new server
    navigate(`/chat/server/${newServer._id}`);
  };

  const getServerInitials = (serverName: string) => {
    return serverName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <div className="server-list">
        {/* Home/DM Button */}
        <div className="server-item server-home" onClick={() => navigate('/friends')} title="Direct Messages">
          <div className="server-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z" />
            </svg>
          </div>
        </div>

        {/* Server Separator */}
        <div className="server-separator"></div>

        {/* Server List */}
        <div className="server-list-scroll">
          {loading ? (
            <div className="server-loading">Loading...</div>
          ) : (
            servers.map((server) => (
              <div
                key={server._id}
                className="server-item"
                onClick={() => handleServerClick(server._id)}
                title={server.serverName}
              >
                <div className="server-icon">
                  {server.serverIcon ? (
                    <img src={server.serverIcon} alt={server.serverName} />
                  ) : (
                    <span className="server-initials">{getServerInitials(server.serverName)}</span>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Create Server Button */}
          <div className="server-item server-add" onClick={handleCreateServer} title="Add a Server">
            <div className="server-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateServerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onServerCreated={handleServerCreated}
        />
      )}
    </>
  );
};

export default ServerList;
