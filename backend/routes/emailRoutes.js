const express = require('express');
const router = express.Router();
const { sendEmail } = require('../controllers/emailController');
const { protectRoutes } = require('../middleware/authMiddleware');

router.post('/send', protectRoutes, sendEmail);

module.exports = router; 