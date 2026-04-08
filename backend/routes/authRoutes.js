const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/getUserProfile
router.post('/getUserProfile', authController.getUserProfile);

// POST /api/auth/verify-email
router.post('/verify-email', authController.verifyEmail);

// POST /api/auth/resend-code
router.post('/resend-code', authController.resendVerificationCode);

// POST /api/auth/refresh
router.post('/refresh', authController.refreshAccessToken);

// POST /api/auth/recover-account
router.post('/recover-account', authController.recoverAccount);

module.exports = router;
