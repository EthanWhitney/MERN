const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// POST /api/profile/updateProfilePicture
router.post('/updateProfilePicture', profileController.updateProfilePicture);

module.exports = router;
