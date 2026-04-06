const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');
const { getUserServers } = require('../controllers/serverController');
const { addFriend, removeFriend, getFriends, searchUserByUsername } = require('../controllers/friendsController');

// GET /api/users/search?username=xxx
router.get('/search', verifyToken, searchUserByUsername);

// GET /api/users/servers
router.get('/servers', verifyToken, getUserServers);

// GET /api/users/friends
router.get('/friends', verifyToken, getFriends);

// POST /api/users/friends/:friendId
router.post('/friends/:friendId', verifyToken, addFriend);

// DELETE /api/users/friends/:friendId
router.delete('/friends/:friendId', verifyToken, removeFriend);

module.exports = router;