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

// Google Auth Routes with browser compatibility fixes
router.get('/google', 
  (req, res, next) => {
    // Get user agent to handle browser-specific concerns
    const userAgent = req.headers['user-agent'] || '';
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Options with browser-specific adjustments
    const options = {
      scope: ['profile', 'email'],
      accessType: 'offline',
      // Skip prompt in Safari due to known issues
      ...(isSafari ? {} : { prompt: 'consent select_account' }),
      // Additional params for cross-browser compatibility
      state: Date.now().toString(), // Prevent CSRF
      session: false,
    };
    
    passport.authenticate('google', options)(req, res, next);
  }
);

router.get('/google/callback', googleCallback);

module.exports = router;