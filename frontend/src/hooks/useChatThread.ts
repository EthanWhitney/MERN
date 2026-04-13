import { useEffect, useState } from 'react';
import {
  deleteThreadMessage,
  getDmConversations,
  getDmThreadMessages,
  getServerThreadMessages,
  sendMessageToThread,
  updateThreadMessage,
} from '../services/chatApi';
import type { ChatMessage, Thread } from '../types/chat';
import { authFetch } from '../utils/authFetch';
import { toMessage } from '../utils/chatAdapter';
import { onReceiveMessage, offReceiveMessage, getConnectionState } from '../services/socketService';

export const useChatThread = (serverId?: string, channelId?: string, recieverId?: string) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageTime, setOldestMessageTime] = useState<string | null>(null);
  const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const dmThreads = await getDmConversations();
        setThreads(dmThreads);

        if (serverId && channelId) {
          const data = await getServerThreadMessages(serverId, channelId);
          setActiveThread(data.thread);
          setMessages(data.messages);
          if (data.messages.length > 0) {
            setOldestMessageTime(data.messages[0].createdAt || null);
            setAllMessagesLoaded(data.messages.length < 50);
          } else {
            setOldestMessageTime(null);
            setAllMessagesLoaded(true);
          }
          setThreads((prev) => {
            const exists = prev.some((t) => t.id === data.thread.id);
            return exists ? prev : [data.thread, ...prev];
          });
          return;
        }

        if (recieverId) {
          const data = await getDmThreadMessages(recieverId);
          setActiveThread(data.thread);
          setMessages(data.messages);
          if (data.messages.length > 0) {
            setOldestMessageTime(data.messages[0].createdAt || null);
            setAllMessagesLoaded(data.messages.length < 50);
          } else {
            setOldestMessageTime(null);
            setAllMessagesLoaded(true);
          }
          setThreads((prev) => {
            const exists = prev.some((t) => t.id === data.thread.id);
            return exists ? prev : [data.thread, ...prev];
          });
          return;
        }

        if (dmThreads.length > 0) {
          const first = dmThreads[0];
          setActiveThread(first);
          if (first.recieverId) {
            const data = await getDmThreadMessages(first.recieverId);
            setMessages(data.messages);
            if (data.messages.length > 0) {
              setOldestMessageTime(data.messages[0].createdAt || null);
              setAllMessagesLoaded(data.messages.length < 50);
            } else {
              setOldestMessageTime(null);
              setAllMessagesLoaded(true);
            }
          } else {
            setMessages([]);
            setOldestMessageTime(null);
            setAllMessagesLoaded(true);
          }
        } else {
          setActiveThread(null);
          setMessages([]);
          setOldestMessageTime(null);
          setAllMessagesLoaded(true);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [serverId, channelId, recieverId]);

  // Listen for real-time socket messages for server channels
  useEffect(() => {
    if (!serverId || !channelId) return;

    const handleSocketMessage = (message: any) => {
      console.log('[useChatThread] Received socket message:', message);

      if (message.type === 'message-updated') {
        // Update existing message in state
        const messageId = message.messageId || message.message?._id || message.message?.id;
        setMessages((prev) =>
          prev.map((msg) =>
            (msg.id === messageId) ? toMessage(message.message, activeThread?.id || '') : msg
          )
        );
      } else if (message.type === 'message-deleted') {
        // Remove deleted message from state
        setMessages((prev) => prev.filter((msg) => msg.id !== message.messageId));
      } else {
        // New message received - transform it to the right format
        const msgId = message._id || message.id;
        if (msgId && activeThread?.id) {
          // Avoid duplicates - only add if not already in state
          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === msgId);
            if (exists) {
              console.log('[useChatThread] Message already in state, skipping duplicate');
              return prev;
            }
            console.log('[useChatThread] Adding new message to state');
            const transformedMessage = toMessage(message, activeThread.id);
            return [...prev, transformedMessage];
          });
        }
      }
    };

    onReceiveMessage(handleSocketMessage);

    return () => {
      offReceiveMessage(handleSocketMessage);
    };
  }, [serverId, channelId, activeThread?.id, getConnectionState()]);

  const sendMessage = async (content: string) => {
    if (!activeThread) {
      return;
    }

    await sendMessageToThread(activeThread, content);
    // Don't add to state here - let the socket broadcast update all users uniformly
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!activeThread) {
      return;
    }

    const updated = await updateThreadMessage(activeThread, messageId, content);
    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      return {
        ...message,
        ...updated,
        id: updated.id || message.id,
        content: updated.content || message.content,
        sender: updated.sender || message.sender,
      };
    }));
  };

  const removeMessage = async (messageId: string) => {
    if (!activeThread) {
      return;
    }

    await deleteThreadMessage(activeThread, messageId);
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  };

  return {
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
    loadMoreMessages: async () => {
      if (!activeThread || messages.length === 0 || !oldestMessageTime) return;

      setIsLoadingMore(true);
      try {
        if (activeThread.kind === 'server' && activeThread.serverId && activeThread.channelId) {
          const response = await authFetch(
            `api/servers/${activeThread.serverId}/textChannels/${activeThread.channelId}/messages?before=${encodeURIComponent(oldestMessageTime)}`
          );
          const data = await response.json();
          if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to load more messages');
          }
          const newMessages = (data.messages || []).map((msg: any) => toMessage(msg, activeThread.id));
          if (newMessages.length > 0) {
            setMessages(prevMessages => [...newMessages, ...prevMessages]);
            const newOldest = newMessages[0];
            setOldestMessageTime(newOldest.createdAt || null);
            if (newMessages.length < 50) {
              setAllMessagesLoaded(true);
            }
          }
        } else if (activeThread.kind === 'dm' && activeThread.recieverId) {
          const response = await authFetch(
            `api/chat/dms/${activeThread.recieverId}/messages?before=${encodeURIComponent(oldestMessageTime)}`
          );
          const data = await response.json();
          if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to load more messages');
          }
          const newMessages = (data.messages || []).map((msg: any) => toMessage(msg, activeThread.id));
          if (newMessages.length > 0) {
            setMessages(prevMessages => [...newMessages, ...prevMessages]);
            const newOldest = newMessages[0];
            setOldestMessageTime(newOldest.createdAt || null);
            if (newMessages.length < 50) {
              setAllMessagesLoaded(true);
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading more messages:', err);
      } finally {
        setIsLoadingMore(false);
      }
    },
  };
};
