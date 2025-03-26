const express = require('express');
const router = express.Router();
const passport = require('../lib/passport');
const { Signup, Login, Logout, checkAuth, getProfile, googleCallback, googleAuth } = require('../controllers/authController');
const { protectRoutes } = require('../middleware/authMiddleware');

router.post('/signup', Signup);
router.post('/login', Login);
router.post('/logout', Logout);
router.get('/check-auth', protectRoutes, checkAuth);
router.get('/profile', protectRoutes, getProfile);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;