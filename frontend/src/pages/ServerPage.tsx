import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ServerPage.css';
import { authFetch } from '../utils/authFetch';
import { normalizeProfilePicturePath } from '../utils/profilePictureUtils';
import { getServer, deleteServer, leaveServer, deleteTextChannel, type Server, type Channel } from '../services/serverApi';
import ServerList from '../components/ServerList';
import CreateChannelModal from '../components/CreateChannelModal';
import InviteToServerModal from '../components/InviteToServerModal';
import InviteLinksPanel from '../components/InviteLinksPanel';
import MessageComposer from '../components/MessageComposer';
import MessageList from '../components/MessageList';
import UserControls from '../components/UserControls';
import { useChatThread } from '../hooks/useChatThread';
import { initSocket, joinServerChannel, leaveServerChannel } from '../services/socketService';
import { VoiceChannel } from '../components/VoiceChannel';

type MemberStatus = 'online' | 'idle' | 'dnd' | 'offline';

const ServerPage = () => {
  const { serverId, channelId } = useParams<{ serverId: string; channelId?: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinksPanel, setShowInviteLinksPanel] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [serverProfiles, setServerProfiles] = useState<any[]>([]);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<{id: string, name: string} | null>(null);
  const [showCreateVoiceModal, setShowCreateVoiceModal] = useState(false);
  const [newVoiceChannelName, setNewVoiceChannelName] = useState('');
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);

  const handleCreateVoiceChannel = async () => {
    if (!newVoiceChannelName.trim() || !serverId) return;
    try {
      setIsCreatingVoice(true);
      await fetch(`/api/servers/${serverId}/voiceChannels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: newVoiceChannelName.trim() }),
      });
      setNewVoiceChannelName('');
      setShowCreateVoiceModal(false);
      await loadServer(serverId);
    } catch (err) {
      console.error('Failed to create voice channel:', err);
    } finally {
      setIsCreatingVoice(false);
    }
  };
  
  // Use chat thread hook for the selected channel from URL
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    editMessage,
    removeMessage,
    isLoadingMore,
    allMessagesLoaded,
    loadMoreMessages,
  } = useChatThread(serverId, channelId, undefined);

  // Get current user ID from localStorage
  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed.id || parsed.userId || '';
    } catch {
      return '';
    }
  }, []);

  // Check if current user is the server owner
  const isOwner = useMemo(() => {
    if (!server || !currentUserId) return false;
    return server.ownerId === currentUserId;
  }, [server, currentUserId]);

  useEffect(() => {
    if (serverId) {
      loadServer(serverId);
      loadServerProfiles(serverId);
    }
  }, [serverId]);

  const loadServerProfiles = useCallback(async (id: string) => {
    try {
      console.log('Loading server profiles for:', id);
      const response = await authFetch(`api/servers/${id}/members/profiles`);
      if (response.ok) {
        const data = await response.json();
        console.log('Server profiles loaded:', data);
        setServerProfiles(data.members || []);
      } else {
        console.error('Failed to load server profiles:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error loading server profiles:', err);
    }
  }, []);

  const handleDMClick = useCallback((userId: string) => {
    navigate(`/friends/${userId}`);
  }, [navigate]);

  const getMemberStatus = useCallback((member: any): MemberStatus => {
    const raw = (member?.status || member?.presence || member?.state || '').toString().toLowerCase();
    if (raw === 'online' || member?.online === true || member?.isOnline === true) return 'online';
    if (raw === 'idle') return 'idle';
    if (raw === 'dnd' || raw === 'do_not_disturb' || raw === 'donotdisturb') return 'dnd';
    return 'offline';
  }, []);

  const getMemberRole = useCallback((member: any): string => {
    return (
      member?.roleName ||
      member?.role ||
      member?.serverRole ||
      member?.roleTitle ||
      member?.roles?.[0]?.name ||
      'Member'
    );
  }, []);

  const getMemberColor = useCallback((member: any): string | undefined => {
    return member?.roleColor || member?.color || member?.accentColor;
  }, []);

  const getMemberInitials = useCallback((member: any): string => {
    const name = (member?.username || member?.name || member?.displayName || '').toString().trim();
    if (!name) return '?';
    return name.slice(0, 1).toUpperCase();
  }, []);

  const memberGroups = useMemo(() => {
    const members = Array.isArray(serverProfiles) ? serverProfiles : [];
    const online: any[] = [];
    const offline: any[] = [];

    for (const member of members) {
      const status = getMemberStatus(member);
      if (status === 'offline') offline.push(member);
      else online.push(member);
    }

    const byName = (a: any, b: any) => {
      const an = (a?.username || a?.name || '').toString().toLowerCase();
      const bn = (b?.username || b?.name || '').toString().toLowerCase();
      return an.localeCompare(bn);
    };

    online.sort(byName);
    offline.sort(byName);

    return { online, offline };
  }, [serverProfiles, getMemberStatus]);

  // Initialize socket and manage channel room subscriptions
  useEffect(() => {
    if (!currentUserId) return;

    console.log('[ServerPage] Initializing socket for user:', currentUserId);
    // Initialize socket connection
    initSocket(currentUserId);

    // Join/leave server channel when channelId changes
    if (channelId && serverId) {
      console.log('[ServerPage] Joining server channel:', serverId, channelId);
      joinServerChannel(serverId, channelId);

      return () => {
        console.log('[ServerPage] Leaving server channel:', serverId, channelId);
        leaveServerChannel(serverId, channelId);
      };
    }
  }, [channelId, serverId, currentUserId]);

  const loadServer = async (id: string) => {
    try {
      setLoading(true);
      const serverData = await getServer(id);
      console.log('voiceChannels from API:', serverData.voiceChannels); 
      setServer(serverData);
    } catch (err: any) {
      setError(err.message || 'Failed to load server');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!serverId) return;
    
    try {
      setIsDeleting(true);
      await deleteServer(serverId);
      // Navigate back to friends page after successful deletion
      navigate('/friends');
    } catch (err: any) {
      console.error('Failed to delete server:', err);
      const errorMessage = err.message || 'Unknown error';
      if (errorMessage.includes('owner')) {
        alert('Only the server owner can delete this server.');
      } else {
        alert('Failed to delete server: ' + errorMessage);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleChannelCreated = async (_newChannel: Channel) => {
    setShowCreateChannelModal(false);
    // Reload the server to get updated channel list
    if (serverId) {
      await loadServer(serverId);
    }
  };

  const handleChannelClick = (channelId: string) => {
    // Navigate to the new URL with channelId
    navigate(`/chat/server/${serverId}/${channelId}`);
  };

  const handleDeleteChannel = async () => {
    if (!serverId || !channelToDelete || !currentUserId) return;
    
    try {
      setIsDeletingChannel(true);
      await deleteTextChannel(serverId, channelToDelete.id, currentUserId);
      
      // If we're deleting the currently viewed channel, navigate back to server overview
      if (channelId === channelToDelete.id) {
        navigate(`/chat/server/${serverId}`);
      }
      
      // Reload the server to get updated channel list
      await loadServer(serverId);
      setChannelToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete channel:', err);
      const errorMessage = err.message || 'Unknown error';
      if (errorMessage.includes('owner')) {
        alert('Only the server owner can delete channels.');
      } else {
        alert('Failed to delete channel: ' + errorMessage);
      }
    } finally {
      setIsDeletingChannel(false);
    }
  };

  if (loading) {
    return (
      <div className="server-screen">
        <ServerList />
        <div className="server-loading">Loading server...</div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="server-screen">
        <ServerList />
        <div className="server-error">
          <h2>Server Not Found</h2>
          <p>{error || 'This server does not exist or you do not have access to it.'}</p>
          <button onClick={() => navigate('/friends')}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="server-screen">
      <ServerList />
      
      {/* Channel List Sidebar */}
      <div className="channel-sidebar">
        <div className="server-header">
          <h2>{server.serverName}</h2>
          <button className="server-dropdown" onClick={() => setShowServerMenu(!showServerMenu)}>▼</button>
          {showServerMenu && (
            <>
              <div className="dropdown-overlay" onClick={() => setShowServerMenu(false)}></div>
              <div className="server-dropdown-menu">
                <button className="dropdown-menu-item invite" onClick={() => {
                  setShowServerMenu(false);
                  setShowInviteModal(true);
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM16 13H13V16H11V13H8V11H11V8H13V11H16V13Z"/>
                  </svg>
                  Invite People
                </button>
                {isOwner && (
                  <button className="dropdown-menu-item invite" onClick={() => {
                    setShowServerMenu(false);
                    setShowInviteLinksPanel(true);
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM16 13H13V16H11V13H8V11H11V8H13V11H16V13Z"/>
                    </svg>
                    Invite Links
                  </button>
                )}
                {isOwner && (
                  <button className="dropdown-menu-item delete" onClick={() => {
                    setShowServerMenu(false);
                    setShowDeleteModal(true);
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
                      <path d="M5 6.99902V20.999C5 22.101 5.897 22.999 7 22.999H17C18.103 22.999 19 22.101 19 20.999V6.99902H5ZM9 18.999H7V8.99902H9V18.999ZM13 18.999H11V8.99902H13V18.999ZM17 18.999H15V8.99902H17V18.999Z" />
                    </svg>
                    Delete Server
                  </button>
                )}
                {!isOwner && (
                  <button className="dropdown-menu-item delete" onClick={async () => {
                    setShowServerMenu(false);
                    setIsLeaving(true);
                    try {
                      if (serverId) {
                        await leaveServer(serverId);
                        navigate('/chat');
                      }
                    } catch (err) {
                      console.error('Error leaving server:', err);
                      setIsLeaving(false);
                    }
                  }} disabled={isLeaving}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H14V19H5V5H14V3H5ZM19 13H12V11H19V13ZM19 17H11V15H19V17ZM19 9H12V7H19V9Z"/>
                    </svg>
                    {isLeaving ? 'Leaving...' : 'Leave Server'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Channel Sections Container - Scrollable */}
        <div className="channel-sections-container">
          {/* Text Channels */}
          <div className="channel-section">
          <div className="channel-section-header">
            <div className="channel-section-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.59 8.59L12 13.17L7.41 8.59L6 10L12 16L18 10L16.59 8.59Z" />
              </svg>
              <span>TEXT CHANNELS</span>
            </div>
            {isOwner && (
              <button 
                className="add-channel-btn" 
                onClick={() => setShowCreateChannelModal(true)}
                title="Create Channel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
                </svg>
              </button>
            )}
          </div>
          <div className="channel-list">
            {server.textChannels && server.textChannels.length > 0 ? (
              server.textChannels.map((channel: any) => (
                <div key={channel._id || channel.channelID} className="channel-item-wrapper">
                  <div 
                    className={`channel-item ${channelId === (channel.channelID || channel._id) ? 'active' : ''}`}
                    onClick={() => handleChannelClick(channel.channelID || channel._id)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z" />
                    </svg>
                    <span>{channel.name}</span>
                  </div>
                  {isOwner && (
                    <button 
                      className="delete-channel-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelToDelete({ 
                          id: channel.channelID || channel._id, 
                          name: channel.name 
                        });
                      }}
                      title="Delete Channel"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
                        <path d="M5 6.99902V20.999C5 22.101 5.897 22.999 7 22.999H17C18.103 22.999 19 22.101 19 20.999V6.99902H5ZM9 18.999H7V8.99902H9V18.999ZM13 18.999H11V8.99902H13V18.999ZM17 18.999H15V8.99902H17V18.999Z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="channel-item channel-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z" />
                </svg>
                <span>general</span>
              </div>
            )}
          </div>
        </div>

        {/* Voice Channels */}
        <div className="channel-section">
          <div className="channel-section-header">
            <div className="channel-section-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.59 8.59L12 13.17L7.41 8.59L6 10L12 16L18 10L16.59 8.59Z" />
              </svg>
              <span>VOICE CHANNELS</span>
            </div>
            {isOwner && (
              <button
                className="add-channel-btn"
                onClick={() => setShowCreateVoiceModal(true)}
                title="Create Voice Channel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
                </svg>
              </button>
            )}
          </div>
          <div className="channel-list">
            {server.voiceChannels && server.voiceChannels.length > 0 ? (
              server.voiceChannels.map((channel: any) => (
                <div
                  key={channel._id}
                  className={`channel-item voice-channel ${activeVoiceChannel?.id === channel._id ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Voice channel clicked:', channel._id, channel.name);
                    setActiveVoiceChannel({ id: channel._id, name: channel.name });
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3C10.34 3 9 4.37 9 6.07V11.93C9 13.63 10.34 15 12 15C13.66 15 15 13.63 15 11.93V6.07C15 4.37 13.66 3 12 3ZM18.5 11C18.5 11 18.5 11.93 18.5 11.93C18.5 15.23 15.86 17.93 12.5 18V21H11V18C7.64 17.93 5 15.23 5 11.93V11H6.5V11.93C6.5 14.41 8.52 16.43 11 16.43H13C15.48 16.43 17.5 14.41 17.5 11.93V11H18.5Z" />
                  </svg>
                  <span>{channel.channelName || channel.name}</span>
                </div>
              ))
            ) : (
              <div className="channel-item voice-channel channel-empty">
                <span>No voice channels</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeVoiceChannel && (
        <VoiceChannel
          channelId={activeVoiceChannel.id}
          channelName={activeVoiceChannel.name}
          currentUserId={currentUserId}
          onLeave={() => setActiveVoiceChannel(null)}
          serverProfiles={serverProfiles}
        />
      )}

      <UserControls isServerPage={true} serverId={serverId} serverProfiles={serverProfiles} onProfileUpdate={() => serverId && loadServerProfiles(serverId)} />
      </div> 

      {/* Main Chat Area */}
      <div className="server-chat-area">
        <div className="server-chat-header">
          <div className="header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z" />
            </svg>
            <span className="channel-name">{channelId ? (server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.channelName || server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.name || 'Channel') : 'Select a channel'}</span>
            {channelId && <div className="channel-description">Welcome to #{server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.channelName || server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.name}!</div>}
          </div>
        </div>

        <div className="server-messages">
          {channelId ? (
            <>
              {messagesLoading && <p className="server-loading">Loading messages...</p>}
              <MessageList
                currentUserId={currentUserId}
                messages={messages}
                onEditMessage={editMessage}
                onDeleteMessage={removeMessage}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMoreMessages}
                allMessagesLoaded={allMessagesLoaded}
                serverProfiles={serverProfiles}
                onDMClick={handleDMClick}
              />
            </>
          ) : (
            <div className="server-welcome">
              <h1>Welcome to {server.serverName}!</h1>
              <p>This is the beginning of the <strong>{server.serverName}</strong> server.</p>
              {server.description && <p className="server-desc">{server.description}</p>}
              <p className="server-hint">👈 Select a channel from the left to start chatting!</p>
            </div>
          )}
        </div>

        {channelId ? (
          <MessageComposer
            disabled={false}
            channelName={server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.channelName || server?.textChannels?.find((ch: any) => (ch.channelID || ch._id) === channelId)?.name}
            onSend={sendMessage}
          />
        ) : (
          <div className="server-message-input">
            <input type="text" placeholder="Select a channel to start messaging" disabled />
          </div>
        )}
      </div>

      {/* Members Sidebar */}
      <aside className="server-members-sidebar" aria-label="Server members">
        <div className="server-members-scroll">
          <div className="member-group">
            <p className="member-group-title">Online - {memberGroups.online.length}</p>
            {memberGroups.online.map((member: any) => {
              const status = getMemberStatus(member);
              const name = member?.username || member?.name || member?.displayName || 'Unknown';
              const role = getMemberRole(member);
              const roleColor = getMemberColor(member);

              return (
                <div
                  className={`member-row member-status-${status}`}
                  key={member?._id || member?.userId || member?.id || name}
                  title={role}
                >
                  <div className="member-avatar" aria-hidden="true">
                    {member?.serverProfilePicture ? (
                      <img src={normalizeProfilePicturePath(member.serverProfilePicture)} alt="" />
                    ) : member?.profilePicture ? (
                      <img src={normalizeProfilePicturePath(member.profilePicture)} alt="" />
                    ) : (
                      getMemberInitials(member)
                    )}
                    <span className="member-status-dot" aria-hidden="true" />
                  </div>
                  <div className="member-meta">
                    <div className="member-name" style={roleColor ? { color: roleColor } : undefined}>
                      {name}
                    </div>
                    <div className="member-role">{role}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="member-group">
            <p className="member-group-title">Offline - {memberGroups.offline.length}</p>
            {memberGroups.offline.map((member: any) => {
              const status = getMemberStatus(member);
              const name = member?.username || member?.name || member?.displayName || 'Unknown';
              const role = getMemberRole(member);
              const roleColor = getMemberColor(member);

              return (
                <div
                  className={`member-row member-status-${status}`}
                  key={member?._id || member?.userId || member?.id || name}
                  title={role}
                >
                  <div className="member-avatar" aria-hidden="true">
                    {member?.serverProfilePicture ? (
                      <img src={normalizeProfilePicturePath(member.serverProfilePicture)} alt="" />
                    ) : member?.profilePicture ? (
                      <img src={normalizeProfilePicturePath(member.profilePicture)} alt="" />
                    ) : (
                      getMemberInitials(member)
                    )}
                    <span className="member-status-dot" aria-hidden="true" />
                  </div>
                  <div className="member-meta">
                    <div className="member-name" style={roleColor ? { color: roleColor } : undefined}>
                      {name}
                    </div>
                    <div className="member-role">{role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h2>Delete '{server.serverName}'</h2>
            </div>
            <div className="delete-modal-body">
              <p>Are you sure you want to delete <strong>{server.serverName}</strong>?</p>
              <p className="delete-warning">This action cannot be undone. All channels and messages will be permanently deleted.</p>
            </div>
            <div className="delete-modal-footer">
              <button 
                className="btn-cancel-delete" 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm-delete" 
                onClick={handleDeleteServer}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Confirmation Modal */}
      {channelToDelete && (
        <div className="delete-modal-overlay" onClick={() => !isDeletingChannel && setChannelToDelete(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h2>Delete Channel</h2>
            </div>
            <div className="delete-modal-body">
              <p>Are you sure you want to delete <strong>#{channelToDelete.name}</strong>?</p>
              <p className="delete-warning">This action cannot be undone. All messages in this channel will be permanently deleted.</p>
            </div>
            <div className="delete-modal-footer">
              <button 
                className="btn-cancel-delete" 
                onClick={() => setChannelToDelete(null)}
                disabled={isDeletingChannel}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm-delete" 
                onClick={handleDeleteChannel}
                disabled={isDeletingChannel}
              >
                {isDeletingChannel ? 'Deleting...' : 'Delete Channel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onChannelCreated={handleChannelCreated}
        serverId={serverId!}
        currentUserId={currentUserId}
      />

      {/* Invite To Server Modal */}
      <InviteToServerModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        serverId={serverId!}
        serverName={server.serverName}
      />

      {/* Invite Links Panel */}
      {showInviteLinksPanel && (
        <InviteLinksPanel
          serverId={serverId!}
          onClose={() => setShowInviteLinksPanel(false)}
        />
      )}

      {showCreateVoiceModal && (
      <div className="delete-modal-overlay" onClick={() => setShowCreateVoiceModal(false)}>
        <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-header">
            <h2>Create Voice Channel</h2>
          </div>
          <div className="delete-modal-body">
            <input
              type="text"
              placeholder="Channel name"
              value={newVoiceChannelName}
              onChange={(e) => setNewVoiceChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateVoiceChannel()}
              autoFocus
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#1e1f22', color: 'white' }}
            />
          </div>
          <div className="delete-modal-footer">
            <button className="btn-cancel-delete" onClick={() => setShowCreateVoiceModal(false)} disabled={isCreatingVoice}>
              Cancel
            </button>
            <button className="btn-confirm-delete" onClick={handleCreateVoiceChannel} disabled={isCreatingVoice || !newVoiceChannelName.trim()}
              style={{ backgroundColor: '#5865f2' }}>
              {isCreatingVoice ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default ServerPage;
