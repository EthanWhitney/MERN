import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import { 
  initSocket, 
  joinDMRoom, 
  sendDMMessage, 
  onReceiveMessage, 
  offReceiveMessage,
  onFriendRequestReceived,
  offFriendRequestReceived,
  onFriendRequestAccepted,
  offFriendRequestAccepted,
  onFriendRequestDeclined,
  offFriendRequestDeclined
} from '../services/socketService';

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

export const useFriendsChat = (recipientId?: string) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageTime, setOldestMessageTime] = useState<string | null>(null);
  const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);

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

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!userId) return;

    console.log('[useFriendsChat] Initializing Socket.IO for user:', userId);
    const sock = initSocket(userId);
    
    // Wait a bit for connection to establish, then log status
    const checkConnection = setTimeout(() => {
      console.log('[useFriendsChat] Socket connection status:', sock?.connected ? 'CONNECTED' : 'NOT YET CONNECTED');
    }, 500);

    return () => {
      clearTimeout(checkConnection);
      // Keep socket alive even when hook unmounts, only disconnect on complete logout
    };
  }, [userId]);

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

  // Load pending friend requests
  useEffect(() => {
    const loadPendingRequests = async () => {
      if (!userId) {
        return;
      }

      try {
        const response = await authFetch(`api/users/friends/pending`);
        
        if (!response.ok) {
          throw new Error(`Failed to load pending requests (${response.status})`);
        }

        const payload = await response.json();
        console.log('Pending requests:', payload.requests);
        
        setPendingRequests(payload.requests || []);
      } catch (err: any) {
        console.error('Error loading pending requests:', err);
        // Don't set error state for pending requests, just log it
      }
    };

    loadPendingRequests();
  }, [userId]);

  // Helper function to reload friends and pending requests
  const reloadFriendsData = async () => {
    try {
      const friendsResponse = await authFetch(`api/users/friends`);
      if (friendsResponse.ok) {
        const payload = await friendsResponse.json();
        setFriends(payload.friends || []);
      }

      const requestsResponse = await authFetch(`api/users/friends/pending`);
      if (requestsResponse.ok) {
        const payload = await requestsResponse.json();
        setPendingRequests(payload.requests || []);
      }
    } catch (err) {
      console.error('Error reloading friends data:', err);
    }
  };

  // Listen for friend request received notifications
  useEffect(() => {
    if (!userId) {
      console.log('[useFriendsChat] Skipping listener registration: no userId');
      return;
    }

    const handleFriendRequestReceived = (data: any) => {
      console.log('[useFriendsChat] 📬 Friend request received event triggered:', data);
      reloadFriendsData();
    };

    // Register listener after socket has time to connect
    const timeout = setTimeout(() => {
      console.log('[useFriendsChat] Setting up onFriendRequestReceived listener');
      onFriendRequestReceived(handleFriendRequestReceived);
    }, 100);

    return () => {
      clearTimeout(timeout);
      console.log('[useFriendsChat] Cleaning up onFriendRequestReceived listener');
      offFriendRequestReceived(handleFriendRequestReceived);
    };
  }, [userId]);

  // Listen for friend request accepted notifications
  useEffect(() => {
    if (!userId) {
      console.log('[useFriendsChat] Skipping listener registration: no userId');
      return;
    }

    const handleFriendRequestAccepted = (data: any) => {
      console.log('[useFriendsChat] ✅ Friend request accepted event triggered:', data);
      reloadFriendsData();
    };

    // Register listener after socket has time to connect
    const timeout = setTimeout(() => {
      console.log('[useFriendsChat] Setting up onFriendRequestAccepted listener');
      onFriendRequestAccepted(handleFriendRequestAccepted);
    }, 100);

    return () => {
      clearTimeout(timeout);
      console.log('[useFriendsChat] Cleaning up onFriendRequestAccepted listener');
      offFriendRequestAccepted(handleFriendRequestAccepted);
    };
  }, [userId]);

  // Listen for friend request declined notifications
  useEffect(() => {
    if (!userId) {
      console.log('[useFriendsChat] Skipping listener registration: no userId');
      return;
    }

    const handleFriendRequestDeclined = (data: any) => {
      console.log('[useFriendsChat] ❌ Friend request declined event triggered:', data);
      reloadFriendsData();
    };

    // Register listener after socket has time to connect
    const timeout = setTimeout(() => {
      console.log('[useFriendsChat] Setting up onFriendRequestDeclined listener');
      onFriendRequestDeclined(handleFriendRequestDeclined);
    }, 100);

    return () => {
      clearTimeout(timeout);
      console.log('[useFriendsChat] Cleaning up onFriendRequestDeclined listener');
      offFriendRequestDeclined(handleFriendRequestDeclined);
    };
  }, [userId]);

  // Load messages when friend is selected and set up real-time listener
  // Uses recipientId param if provided, otherwise uses selectedFriend state
  useEffect(() => {
    const loadMessages = async () => {
      const targetId = recipientId || selectedFriend?._id;
      
      if (!targetId || !userId) {
        setMessages([]);
        setOldestMessageTime(null);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const response = await authFetch(
          `api/chat/dms/${targetId}/messages?limit=50`
        );

        if (!response.ok) {
          throw new Error('Failed to load messages.');
        }

        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error);
        }

        const loadedMessages = payload.messages || [];
        setMessages(loadedMessages);
        
        // Track the oldest message's timestamp and whether all messages are loaded
        if (loadedMessages.length > 0) {
          const oldest = loadedMessages[0];
          setOldestMessageTime(oldest.createdAt || null);
          // If we got fewer than 50 messages, we've reached the beginning
          setAllMessagesLoaded(loadedMessages.length < 50);
        } else {
          setOldestMessageTime(null);
          setAllMessagesLoaded(true);
        }

        // Join the DM room for real-time updates
        joinDMRoom(targetId);
      } catch (err: any) {
        console.error('Error loading messages:', err);
        setError('Failed to load messages');
        setMessages([]);
        setOldestMessageTime(null);
        setAllMessagesLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [recipientId || selectedFriend?._id, userId]);

  // Listen for incoming real-time messages
  useEffect(() => {
    const handleReceiveMessage = (incomingMessage: any) => {
      console.log('Received real-time message:', incomingMessage);
      setMessages(prevMessages => [...prevMessages, incomingMessage]);
    };

    onReceiveMessage(handleReceiveMessage);

    return () => {
      offReceiveMessage(handleReceiveMessage);
    };
  }, []);

  // Send message
  const sendMessage = async (messageInput: string): Promise<boolean> => {
    const targetId = recipientId || selectedFriend?._id;
    
    if (!messageInput.trim() || !targetId || !userId) return false;

    setIsSending(true);
    try {
      const response = await authFetch(
        `api/chat/dms/${targetId}/messages`,
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
        const newMessage = payload.message;
        
        // Emit message via Socket.IO - let the listener handle adding to state
        // to avoid duplicate messages
        sendDMMessage(targetId, newMessage);
        
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

  // Accept friend request
  const acceptFriendRequest = async (friendId: string): Promise<boolean> => {
    try {
      const response = await authFetch(
        `api/users/friends/${friendId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error || 'Failed to accept friend request');
      }

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(req => req._id !== friendId));
      
      // Reload friends list
      const friendsResponse = await authFetch(`api/users/friends`);
      if (friendsResponse.ok) {
        const payload = await friendsResponse.json();
        setFriends(payload.friends || []);
      }

      return true;
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      return false;
    }
  };

  // Decline friend request
  const declineFriendRequest = async (friendId: string): Promise<boolean> => {
    try {
      const response = await authFetch(
        `api/users/friends/${friendId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error || 'Failed to decline friend request');
      }

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(req => req._id !== friendId));

      return true;
    } catch (err: any) {
      console.error('Error declining friend request:', err);
      return false;
    }
  };

  // Edit message
  const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    const targetId = recipientId || selectedFriend?._id;
    
    if (!newContent.trim() || !targetId || !userId) {
      console.error('Edit validation failed:', { messageId, newContent: newContent.trim(), targetId, userId });
      return false;
    }

    try {
      const endpoint = `api/chat/dms/${targetId}/messages/${messageId}`;
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
    const targetId = recipientId || selectedFriend?._id;
    
    if (!targetId || !userId) {
      console.error('Delete validation failed:', { messageId, targetId, userId });
      return false;
    }

    try {
      const endpoint = `api/chat/dms/${targetId}/messages/${messageId}`;
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
    pendingRequests,
    selectedFriend,
    setSelectedFriend,
    messages,
    loading,
    error,
    isSending,
    isLoadingMore,
    allMessagesLoaded,
    sendMessage,
    addFriend,
    acceptFriendRequest,
    declineFriendRequest,
    editMessage,
    deleteMessage,
    loadMoreMessages: async () => {
      const targetId = recipientId || selectedFriend?._id;
      if (!targetId || !userId || messages.length === 0 || !oldestMessageTime) return;

      setIsLoadingMore(true);
      try {
        const response = await authFetch(
          `api/chat/dms/${targetId}/messages?limit=50&before=${encodeURIComponent(oldestMessageTime)}`
        );

        if (!response.ok) {
          throw new Error('Failed to load more messages.');
        }

        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error);
        }

        if (payload.messages && payload.messages.length > 0) {
          setMessages(prevMessages => [...payload.messages, ...prevMessages]);
          const newOldest = payload.messages[0];
          setOldestMessageTime(newOldest.createdAt || null);
          // If we got fewer than 50 messages, we've reached the beginning
          if (payload.messages.length < 50) {
            setAllMessagesLoaded(true);
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
