import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import FriendsChat from '../components/FriendsChat';
import FriendsPanel from '../components/FriendsPanel';
import ServerList from '../components/ServerList';
import { authFetch } from '../utils/authFetch';
import './FriendsPage.css';

interface Friend {
  _id: string;
  username: string;
  profilePicture?: string;
  online?: boolean;
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
    } else if (location.pathname.startsWith('/friends/online')) {
      setActiveTab('online');
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

  // When friend is selected, navigate to their URL and switch away from All tab
  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    if (activeTab === 'online') {
      navigate(`/friends/online/${friend._id}`);
    } else {
      navigate(`/friends/${friend._id}`);
    }
  };

  const handleTabChange = (tab: 'online' | 'all' | 'requests') => {
    setActiveTab(tab);
    if (tab === 'all') {
      setSelectedFriend(null);
      navigate('/friends');
    } else if (tab === 'online') {
      setSelectedFriend(null);
      navigate('/friends/online');
    } else if (tab === 'requests') {
      navigate('/friends/requests');
    }
  };

  return (
    <div className="friends-screen">
      <div className="friends-glow" aria-hidden="true" />
      <ServerList />
      <FriendsPanel 
        selectedFriend={selectedFriend} 
        onSelectFriend={handleSelectFriend}
        activeTab={activeTab}
      />
      <FriendsChat 
        selectedFriend={selectedFriend} 
        currentUserId={currentUserId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSelectFriend={handleSelectFriend}
      />
    </div>
  );
};

export default FriendsPage;
