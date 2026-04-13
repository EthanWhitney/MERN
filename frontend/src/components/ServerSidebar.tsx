import { useState, useEffect, useRef } from 'react';
import { buildPath } from '../utils/config';
import './ServerSidebar.css';

interface Server {
  _id: string;
  serverName: string;
  serverIcon: string;
  description: string;
  ownerId: string;
}

interface ServerSidebarProps {
  onServerSelect?: (server: Server | null) => void;
  selectedServerId?: string | null;
}

function ServerSidebar({ onServerSelect, selectedServerId }: ServerSidebarProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [joinServerId, setJoinServerId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; top: number } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userData = JSON.parse(localStorage.getItem('user_data') || '{}') as { id?: string; username?: string };
  const userId = userData.id || '';

  useEffect(() => {
    if (userId) fetchServers();
  }, [userId]);

  async function fetchServers() {
    try {
      const res = await fetch(buildPath(`api/users/${userId}/servers`));
      const data = await res.json() as { servers?: Server[]; error?: string };
      if (!data.error) setServers(data.servers || []);
    } catch (e) {
      console.error('Failed to fetch servers:', e);
    }
  }

  async function handleCreateServer() {
    if (!serverName.trim()) { setError('Server name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildPath('api/servers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName: serverName.trim(), description: serverDescription.trim(), ownerId: userId }),
      });
      const data = await res.json() as { server?: Server; error?: string };
      if (data.error || !data.server) { setError(data.error || 'Failed to create server'); return; }
      setServers(prev => [...prev, data.server!]);
      onServerSelect?.(data.server!);
      closeModal();
    } catch {
      setError('Failed to create server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinServer() {
    if (!joinServerId.trim()) { setError('Server ID is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildPath(`api/servers/${joinServerId.trim()}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json() as { serverProfile?: object; error?: string };
      if (data.error) { setError(data.error); return; }
      await fetchServers();
      closeModal();
    } catch {
      setError('Failed to join server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setServerName('');
    setServerDescription('');
    setJoinServerId('');
    setError('');
    setTimeout(() => setModalMode('choose'), 200);
  }

  function openTooltip(text: string, el: HTMLElement) {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const rect = el.getBoundingClientRect();
    setTooltip({ text, top: rect.top + rect.height / 2 });
  }

  function hideTooltip() {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 80);
  }

  function getInitials(name: string) {
    return name
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const SERVER_COLORS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55C', '#FAA61A', '#00D5FF'];
  function getServerColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return SERVER_COLORS[Math.abs(hash) % SERVER_COLORS.length];
  }

  return (
    <>
      <nav className="server-sidebar" aria-label="Servers">

        {/* Home button */}
        <button
          className={`ss-icon home-icon ${!selectedServerId ? 'active' : ''}`}
          onClick={() => onServerSelect?.(null)}
          aria-label="Home"
          onMouseEnter={e => openTooltip('Home', e.currentTarget)}
          onMouseLeave={hideTooltip}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          {!selectedServerId && <span className="active-pip" />}
        </button>

        <div className="ss-divider" />

        {/* Server list */}
        <div className="ss-server-list" role="list">
          {servers.map(server => {
            const isActive = selectedServerId === server._id;
            return (
              <button
                key={server._id}
                className={`ss-icon server-btn ${isActive ? 'active' : ''}`}
                onClick={() => onServerSelect?.(server)}
                aria-label={server.serverName}
                aria-pressed={isActive}
                role="listitem"
                onMouseEnter={e => openTooltip(server.serverName, e.currentTarget)}
                onMouseLeave={hideTooltip}
              >
                {server.serverIcon ? (
                  <img src={server.serverIcon} alt={server.serverName} className="ss-server-img" />
                ) : (
                  <span
                    className="ss-initials"
                    style={{ background: getServerColor(server.serverName) }}
                  >
                    {getInitials(server.serverName)}
                  </span>
                )}
                {isActive && <span className="active-pip" />}
              </button>
            );
          })}
        </div>

        {/* Add server */}
        <button
          className="ss-icon add-btn"
          onClick={() => setShowModal(true)}
          aria-label="Add a Server"
          onMouseEnter={e => openTooltip('Add a Server', e.currentTarget)}
          onMouseLeave={hideTooltip}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="ss-tooltip"
            style={{ top: tooltip.top }}
            aria-hidden="true"
          >
            <span className="ss-tooltip-arrow" />
            {tooltip.text}
          </div>
        )}
      </nav>

      {/* Modal */}
      {showModal && (
        <div className="ss-overlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="ss-modal" onClick={e => e.stopPropagation()}>

            {modalMode === 'choose' && (
              <div className="ss-choose">
                <div className="ss-modal-header">
                  <h2>Add a Server</h2>
                  <p>A server is where you and your friends hang out. Make yours and start talking.</p>
                </div>
                <button className="ss-choose-btn" onClick={() => setModalMode('create')}>
                  <span className="ss-choose-icon">✦</span>
                  <span className="ss-choose-text">
                    <strong>Create My Own</strong>
                    <small>Start fresh with a new server</small>
                  </span>
                  <span className="ss-choose-arrow">›</span>
                </button>
                <button className="ss-choose-btn" onClick={() => setModalMode('join')}>
                  <span className="ss-choose-icon">⊕</span>
                  <span className="ss-choose-text">
                    <strong>Join a Server</strong>
                    <small>Enter a server ID to join</small>
                  </span>
                  <span className="ss-choose-arrow">›</span>
                </button>
                <button className="ss-close-btn" onClick={closeModal} aria-label="Close">✕</button>
              </div>
            )}

            {modalMode === 'create' && (
              <div className="ss-form">
                <button className="ss-back-btn" onClick={() => { setModalMode('choose'); setError(''); }}>‹ Back</button>
                <button className="ss-close-btn" onClick={closeModal} aria-label="Close">✕</button>
                <div className="ss-modal-header">
                  <div className="ss-server-preview" style={{ background: serverName ? getServerColor(serverName) : '#313338' }}>
                    {serverName ? getInitials(serverName) : '?'}
                  </div>
                  <h2>Create Your Server</h2>
                  <p>Give your server a name and make it yours.</p>
                </div>
                <label htmlFor="ss-server-name">SERVER NAME</label>
                <input
                  id="ss-server-name"
                  type="text"
                  placeholder="My Awesome Server"
                  value={serverName}
                  maxLength={100}
                  onChange={e => setServerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateServer()}
                  autoFocus
                />
                <label htmlFor="ss-server-desc">DESCRIPTION <span className="optional">— optional</span></label>
                <input
                  id="ss-server-desc"
                  type="text"
                  placeholder="What's this server about?"
                  value={serverDescription}
                  onChange={e => setServerDescription(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateServer()}
                />
                {error && <p className="ss-error" role="alert">{error}</p>}
                <div className="ss-actions">
                  <button className="ss-btn-ghost" onClick={closeModal}>Cancel</button>
                  <button className="ss-btn-primary" onClick={handleCreateServer} disabled={loading || !serverName.trim()}>
                    {loading ? <span className="ss-spinner" /> : 'Create Server'}
                  </button>
                </div>
              </div>
            )}

            {modalMode === 'join' && (
              <div className="ss-form">
                <button className="ss-back-btn" onClick={() => { setModalMode('choose'); setError(''); }}>‹ Back</button>
                <button className="ss-close-btn" onClick={closeModal} aria-label="Close">✕</button>
                <div className="ss-modal-header">
                  <div className="ss-server-preview" style={{ background: '#5865F2' }}>⊕</div>
                  <h2>Join a Server</h2>
                  <p>Enter a server ID shared by a friend or community.</p>
                </div>
                <label htmlFor="ss-join-id">SERVER ID</label>
                <input
                  id="ss-join-id"
                  type="text"
                  placeholder="e.g. 507f1f77bcf86cd799439011"
                  value={joinServerId}
                  onChange={e => setJoinServerId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoinServer()}
                  autoFocus
                />
                {error && <p className="ss-error" role="alert">{error}</p>}
                <div className="ss-actions">
                  <button className="ss-btn-ghost" onClick={closeModal}>Cancel</button>
                  <button className="ss-btn-primary" onClick={handleJoinServer} disabled={loading || !joinServerId.trim()}>
                    {loading ? <span className="ss-spinner" /> : 'Join Server'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ServerSidebar;
