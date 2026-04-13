const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');

const {
  getInviteMetadata,
  joinViaInvite,
} = require('../controllers/inviteController');

// Get invite metadata (public, no auth required)
router.get('/:linkCode', getInviteMetadata);

// Join server via invite link (requires auth)
router.post('/:linkCode/join', verifyToken, joinViaInvite);

module.exports = router;
