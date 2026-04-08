import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './FriendsPage.css';
import { authFetch } from '../utils/authFetch';
import FriendsPanel from '../components/FriendsPanel';
import FriendsChat from '../components/FriendsChat';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
}

const FriendsPage = () => {
  const { friendId } = useParams<{ friendId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'requests'>('all');

  // Detect if we're on the requests page based on URL
  useEffect(() => {
    if (location.pathname === '/friends/requests') {
      setActiveTab('requests');
    } else {
      setActiveTab('all');
    }
  }, [location.pathname]);

  // Derive currentUserId from localStorage for passing to FriendsChat
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

  // Load friends list from useFriendsChat hook
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await authFetch('api/users/friends');
        if (response.ok) {
          const data = await response.json();
          setFriends(data.friends || []);
        }
      } catch (err) {
        console.error('Error loading friends:', err);
      }
    };
    loadFriends();
  }, []);

  // When friendId URL param changes, find and select that friend
  useEffect(() => {
    if (friendId && friends.length > 0) {
      const friend = friends.find(f => f._id === friendId);
      setSelectedFriend(friend || null);
    }
  }, [friendId, friends]);

  // When friend is selected, navigate to their URL
  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    navigate(`/friends/${friend._id}`);
  };

  return (
    <div className="friends-screen">
      <div className="friends-glow" aria-hidden="true" />
      <FriendsPanel 
        selectedFriend={selectedFriend} 
        onSelectFriend={handleSelectFriend}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'requests') {
            navigate('/friends/requests');
          } else {
            navigate('/friends');
          }
        }}
      />
      <FriendsChat 
        selectedFriend={selectedFriend} 
        currentUserId={currentUserId}
        activeTab={activeTab}
      />
    </div>
  );
};

export default FriendsPage;
