const express = require('express');
const router = express.Router();
const passport = require('../lib/passport');
const { Signup, Login, Logout, refreshToken, checkAuth, getProfile, googleCallback } = require('../controllers/authController');
const { protectRoutes } = require('../middleware/authMiddleware');

router.post('/signup', Signup);
router.post('/login', Login);
router.post('/logout', protectRoutes, Logout);
router.post('/refresh-token', refreshToken);
router.get('/check-auth', protectRoutes, checkAuth);
router.get('/profile', protectRoutes, getProfile);

// Google Auth Routes with proper consent parameter
router.get('/google', 
  (req, res, next) => {
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent select_account'
    })(req, res, next);
  }
);

router.get('/google/callback', googleCallback);

module.exports = router;