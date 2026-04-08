const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');
const profileController = require('../controllers/profileController');

// POST /api/profile/updateProfilePicture
router.post('/updateProfilePicture', verifyToken, profileController.updateProfilePicture);

module.exports = router;
