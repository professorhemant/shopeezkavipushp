'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public registration is disabled — this is a private app, accounts are created
// internally. Set ALLOW_PUBLIC_REGISTRATION=true to re-enable if ever needed.
router.post('/register', (req, res, next) => {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === 'true') return authController.register(req, res, next);
  return res.status(403).json({ success: false, message: 'Registration is disabled.' });
});
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/request-edit-otp', authenticate, authController.requestEditOtp);
router.post('/verify-edit-otp', authenticate, authController.verifyEditOtp);

module.exports = router;
