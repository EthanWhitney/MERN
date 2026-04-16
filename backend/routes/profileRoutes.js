const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');
const profileController = require('../controllers/profileController');

// POST /api/profile/updateProfilePicture
router.post('/updateProfilePicture', verifyToken, profileController.updateProfilePicture);

// POST /api/profile/migrateAvatarFormats
router.post('/migrateAvatarFormats', profileController.migrateAvatarFormats);

module.exports = router;
