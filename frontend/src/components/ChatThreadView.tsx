// src/components/ChatThreadView.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import ThreadHeader from './ThreadHeader';
import ThreadList from './ThreadList';
import ServerMemberList from './ServerMemberList';
import { useChatThread } from '../hooks/useChatThread';
import type { Thread } from '../types/chat';
import './ChatThreadView.css';

type ChatThreadViewProps = {
  serverId?: string;
  channelId?: string;
  recieverId?: string;
  showSidebar?: boolean;
  className?: string;
};

function ChatThreadView({
  serverId,
  channelId,
  recieverId,
  showSidebar = true,
  className = '',
}: ChatThreadViewProps) {
  const navigate = useNavigate();
  const {
    threads,
    activeThread,
    messages,
    loading,
    error,
    isLoadingMore,
    allMessagesLoaded,
    setActiveThread,
    setMessages,
    sendMessage,
    editMessage,
    removeMessage,
    loadMoreMessages,
  } = useChatThread(serverId, channelId, recieverId);

  const currentUserId = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('user_data');
      if (!rawUser) return '';
      const parsed = JSON.parse(rawUser);
      return parsed?.id || '';
    } catch {
      return '';
    }
  }, []);

  // Show the member list only when we're inside a server channel
  const isServerChannel = Boolean(serverId && channelId);

  const handleSelectThread = (thread: Thread) => {
    setActiveThread(thread);
    setMessages([]);

    if (thread.kind === 'server' && thread.serverId && thread.channelId) {
      navigate(`/chat/server/${thread.serverId}/${thread.channelId}`);
      return;
    }

    if (thread.kind === 'dm' && thread.recieverId) {
      navigate(`/chat/dm/${thread.recieverId}`);
    }
  };

  return (
    <div
      className={`chat-thread-view ${isServerChannel ? 'chat-thread-view--server' : ''} ${className}`.trim()}
    >
      {showSidebar && (
        <ThreadList
          threads={threads}
          activeThreadId={activeThread?.id || ''}
          onSelectThread={handleSelectThread}
        />
      )}

      <section className="chat-thread-panel">
        <ThreadHeader thread={activeThread} />

        {loading && (
          <p className="muted chat-thread-status">Loading chat…</p>
        )}
        {error && (
          <p className="error-text chat-thread-status">{error}</p>
        )}

        <MessageList
          currentUserId={currentUserId}
          messages={messages}
          onEditMessage={editMessage}
          onDeleteMessage={removeMessage}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreMessages}
          allMessagesLoaded={allMessagesLoaded}
        />

        <MessageComposer disabled={!activeThread} onSend={sendMessage} />
      </section>

      {/* Right-side member list — only visible inside a server channel */}
      {isServerChannel && <ServerMemberList serverId={serverId!} />}
    </div>
  );
}

export default ChatThreadView;
