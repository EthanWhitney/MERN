//import React from 'react';
import { BrowserRouter as Router, Route, Navigate, Routes } from 'react-router-dom';
import './App.css';
import Token from './components/Token';
import Register from './components/Register';
import VerifyCode from './components/VerifyCode.tsx';
import LoginPage from './pages/LoginPage';
import CardPage from './pages/CardPage';
import FriendsPage from './pages/FriendsPage.tsx';

function App() {
  return (
    <Router >
      <Routes>
        <Route path="/verify/:token" element={<Token/>}/>
        <Route path="/verify-code" element={<VerifyCode/>}/>
        <Route path="/" element={<LoginPage/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<Register/>}/>
        <Route path="/cards" element={<CardPage/>}/>
        <Route path="/friends" element={<FriendsPage/>}/>
        <Route path="*" element={<Navigate to="/" replace />}/>
      </Routes>  
    </Router>
  );
}
export default App;