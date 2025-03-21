const express = require('express');
const router = express.Router();
const { protectRoutes } = require('../middleware/authMiddleware');
const { 
    saveChat, 
    getChat, 
    getChatHistory,
    updateChat,
    deleteChat
} = require('../controllers/chatController');

router.get('/history/all', protectRoutes, getChatHistory);
router.post('/save', protectRoutes, saveChat);
router.put('/:chatId/update', protectRoutes, updateChat);
router.get('/:chatId', protectRoutes, getChat);
router.delete('/:chatId', protectRoutes, deleteChat);

module.exports = router; 