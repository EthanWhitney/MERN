const express = require('express');
const router = express.Router();
const { getUserServers } = require('../controllers/serverController');
const { addFriend, removeFriend, getFriends } = require('../controllers/friendsController');

// GET /api/users/:userId/servers
router.get('/:userId/servers', getUserServers);

// GET /api/users/:userId/friends
router.get('/:userId/friends', getFriends);

// POST /api/users/:userId/friends/:friendId
router.post('/:userId/friends/:friendId', addFriend);

// DELETE /api/users/:userId/friends/:friendId
router.delete('/:userId/friends/:friendId', removeFriend);

module.exports = router;