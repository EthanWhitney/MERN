import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/authFetch';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

export interface ChatMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  message: string;
  createdAt?: string;
  edited?: boolean;
  editedAt?: string;
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
        console.log('Loading friends for userId:', userId);
        const response = await authFetch(`api/users/friends`);
        
        console.log('Friends response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Friends API error response:', errorText);
          throw new Error(`Failed to load friends (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const payload = await response.json();
        console.log('Friends payload:', payload);
        
        if (payload.error) {
          throw new Error(payload.error);
        }

        setFriends(payload.friends || []);
      } catch (err: any) {
        const errorMsg = err?.message || err?.toString?.() || 'Unable to load friends.';
        console.error('Error in loadFriends:', errorMsg);
        setError(errorMsg);
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
          `api/chat/dms/${selectedFriend._id}/messages?limit=50`
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
        `api/chat/dms/${selectedFriend._id}/messages`,
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

  // Add friend by username
  const addFriend = async (username: string): Promise<boolean> => {
    if (!userId) {
      throw new Error('Not logged in');
    }

    try {
      // First, search for user by username
      const searchResponse = await authFetch(
        `api/users/search?username=${encodeURIComponent(username)}`
      );

      if (!searchResponse.ok) {
        const errorPayload = await searchResponse.json();
        throw new Error(errorPayload.error || 'User not found');
      }

      const searchData = await searchResponse.json();
      const friendId = searchData.user?._id;

      if (!friendId) {
        throw new Error('User not found');
      }

      // Then add them as a friend
      const addResponse = await authFetch(
        `api/users/friends/${friendId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!addResponse.ok) {
        const errorPayload = await addResponse.json();
        throw new Error(errorPayload.error || 'Failed to add friend');
      }

      const payload = await addResponse.json();
      
      // Update friends list with response
      if (payload.friends && Array.isArray(payload.friends)) {
        setFriends(payload.friends);
      }

      return true;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to add friend';
      console.error('Error adding friend:', errorMsg);
      throw new Error(errorMsg);
    }
  };

  // Edit message
  const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!newContent.trim() || !selectedFriend || !userId) {
      console.error('Edit validation failed:', { messageId, newContent: newContent.trim(), selectedFriend, userId });
      return false;
    }

    try {
      const endpoint = `api/chat/dms/${selectedFriend._id}/messages/${messageId}`;
      console.log('Editing message:', { endpoint, newContent });
      
      const response = await authFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newContent }),
      });

      console.log('Edit response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edit error response:', { status: response.status, text: errorText });
        throw new Error(`Failed to edit message (${response.status}): ${errorText}`);
      }

      const payload = await response.json();
      console.log('Edit payload:', payload);
      
      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.message) {
        setMessages(messages.map(msg => msg._id === messageId ? payload.message : msg));
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error editing message:', err);
      return false;
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!selectedFriend || !userId) {
      console.error('Delete validation failed:', { messageId, selectedFriend, userId });
      return false;
    }

    try {
      const endpoint = `api/chat/dms/${selectedFriend._id}/messages/${messageId}`;
      console.log('Deleting message:', { endpoint });
      
      const response = await authFetch(endpoint, {
        method: 'DELETE',
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete error response:', { status: response.status, text: errorText });
        throw new Error(`Failed to delete message (${response.status}): ${errorText}`);
      }

      setMessages(messages.filter(msg => msg._id !== messageId));
      return true;
    } catch (err: any) {
      console.error('Error deleting message:', err);
      return false;
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
    addFriend,
    editMessage,
    deleteMessage,
  };
};
