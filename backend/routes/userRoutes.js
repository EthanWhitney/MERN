const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');
const { getUserServers } = require('../controllers/serverController');
const { 
  sendFriendRequest, 
  acceptFriendRequest, 
  removeFriend, 
  getFriends, 
  searchUserByUsername,
  getPendingRequests 
} = require('../controllers/friendsController');

// search user by username
// GET /api/users/search?username=xxx
router.get('/search', verifyToken, searchUserByUsername);

// get all servers for a user
// GET /api/users/servers
router.get('/servers', verifyToken, getUserServers);

// get all friends for a user
// GET /api/users/friends
router.get('/friends', verifyToken, getFriends);

// get pending friend requests
// GET /api/users/friends/pending
router.get('/friends/pending', verifyToken, getPendingRequests);

// send friend request
// POST /api/users/friends/:friendId
router.post('/friends/:friendId', verifyToken, sendFriendRequest);

// accept friend request
// POST /api/users/friends/:friendId/accept
router.post('/friends/:friendId/accept', verifyToken, acceptFriendRequest);

// remove friend or decline/cancel request
// DELETE /api/users/friends/:friendId
router.delete('/friends/:friendId', verifyToken, removeFriend);

module.exports = router;