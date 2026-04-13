import { useState } from 'react';
import ServerSidebar from '../components/ServerSidebar';
import './CardPage.css';

interface Server {
  _id: string;
  serverName: string;
  serverIcon: string;
  description: string;
  ownerId: string;
}

const CardPage = () => {
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  const userData = JSON.parse(localStorage.getItem('user_data') || '{}') as { username?: string; id?: string };

  function doLogout() {
    localStorage.removeItem('user_data');
    localStorage.removeItem('token_data');
    window.location.href = '/';
  }

  return (
    <div className="app-layout">
      {/* Left: Server sidebar */}
      <ServerSidebar
        onServerSelect={setSelectedServer}
        selectedServerId={selectedServer?._id ?? null}
      />

      {/* Middle: Channel list placeholder */}
      <aside className="channel-sidebar">
        <div className="channel-sidebar-header">
          <span className="channel-sidebar-title">
            {selectedServer ? selectedServer.serverName : 'Direct Messages'}
          </span>
        </div>
        <div className="channel-sidebar-body">
          {selectedServer ? (
            <p className="coming-soon">Channels coming soon…</p>
          ) : (
            <p className="coming-soon">Friends &amp; DMs coming soon…</p>
          )}
        </div>
        {/* User panel */}
        <div className="user-panel">
          <div className="user-avatar">
            {userData.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="user-info">
            <span className="user-name">{userData.username ?? 'Unknown'}</span>
            <span className="user-status">Online</span>
          </div>
          <button className="logout-btn" onClick={doLogout} title="Log Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="main-content">
        {selectedServer ? (
          <div className="content-placeholder">
            <div className="content-placeholder-icon">#</div>
            <h2>{selectedServer.serverName}</h2>
            <p>{selectedServer.description || 'Welcome to the beginning of this server.'}</p>
            <span className="content-badge">Chat coming soon</span>
          </div>
        ) : (
          <div className="content-placeholder">
            <div className="content-placeholder-icon home-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <h2>Welcome back, {userData.username ?? 'there'}!</h2>
            <p>Select a server from the sidebar, or create one to get started.</p>
            <span className="content-badge">More features coming soon</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default CardPage;
