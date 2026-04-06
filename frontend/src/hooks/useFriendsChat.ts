import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import { buildPath } from '../utils/config';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface ChatMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  message: string;
  createdAt?: string;
}

export const useFriendsChat = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

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

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      if (!userId) {
        setError('No user logged in.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await authFetch(buildPath(`api/users/${userId}/friends`));
        
        if (!response.ok) {
          throw new Error('Failed to load friends.');
        }

        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error);
        }

        setFriends(payload.friends || []);
      } catch (err: any) {
        setError(err?.message || err?.toString?.() || 'Unable to load friends.');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [userId]);

  // Load messages when friend is selected
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedFriend || !userId) {
        setMessages([]);
        return;
      }

      try {
        const response = await authFetch(
          buildPath(`api/chat/dm/${selectedFriend._id}?limit=50`)
        );

        if (!response.ok) {
          throw new Error('Failed to load messages.');
        }

        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error);
        }

        setMessages(payload.messages || []);
      } catch (err: any) {
        console.error('Error loading messages:', err);
        setMessages([]);
      }
    };

    loadMessages();
  }, [selectedFriend, userId]);

  // Send message
  const sendMessage = async (messageInput: string): Promise<boolean> => {
    if (!messageInput.trim() || !selectedFriend || !userId) return false;

    setIsSending(true);
    try {
      const response = await authFetch(
        buildPath(`api/chat/dm/${selectedFriend._id}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageInput }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message.');
      }

      const payload = await response.json();
      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.message) {
        setMessages([...messages, payload.message]);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error sending message:', err);
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return {
    userId,
    friends,
    selectedFriend,
    setSelectedFriend,
    messages,
    loading,
    error,
    isSending,
    sendMessage,
  };
};
