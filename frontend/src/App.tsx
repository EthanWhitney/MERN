import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Route, Navigate, Routes } from 'react-router-dom';
import './App.css';
import Token from './components/Token';
import Register from './components/Register';
import VerifyCode from './components/VerifyCode.tsx';
import LoginPage from './pages/LoginPage';
import CardPage from './pages/CardPage';
import ChatPage from './pages/ChatPage';
import FriendsPage from './pages/FriendsPage';
import ServerPage from './pages/ServerPage';
import JoinPage from './pages/JoinPage';
import { isTokenValid } from './utils/tokenStorage';
import { initSocket } from './utils/socketService';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  if (!isTokenValid()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  // Get current user ID from localStorage for socket initialization
  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (!raw) return '';
      return JSON.parse(raw)?.id || '';
    } catch {
      return '';
    }
  }, []);

  // Initialize socket for logged-in users on app startup
  useEffect(() => {
    if (currentUserId && isTokenValid()) {
      console.log('[App] Initializing socket for user:', currentUserId);
      initSocket(currentUserId);
    }
  }, [currentUserId]);

  return (
    <Router >
      <Routes>
        <Route path="/verify/:token" element={<Token/>}/>
        <Route path="/verify-code" element={<VerifyCode/>}/>
        <Route path="/" element={<LoginPage/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<Register/>}/>
        <Route path="/join/:linkCode" element={<JoinPage/>}/>
        <Route path="/friends" element={<ProtectedRoute><FriendsPage/></ProtectedRoute>}/>
        <Route path="/friends/requests" element={<ProtectedRoute><FriendsPage/></ProtectedRoute>}/>
        <Route path="/friends/:friendId" element={<ProtectedRoute><FriendsPage/></ProtectedRoute>}/>
        <Route path="/cards" element={<ProtectedRoute><CardPage/></ProtectedRoute>}/>
        <Route path="/chat" element={<ProtectedRoute><ChatPage/></ProtectedRoute>}/>
        <Route path="/chat/server/:serverId" element={<ProtectedRoute><ServerPage/></ProtectedRoute>}/>
        <Route path="/chat/server/:serverId/:channelId" element={<ProtectedRoute><ServerPage/></ProtectedRoute>}/>
        <Route path="/chat/dm/:recieverId" element={<ProtectedRoute><ChatPage/></ProtectedRoute>}/>
        <Route path="*" element={<Navigate to="/" replace />}/>
      </Routes>  
    </Router>
  );
}
export default App;