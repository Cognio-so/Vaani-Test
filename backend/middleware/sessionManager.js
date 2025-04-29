const { redisHelper } = require('../config/redis');

const SESSION_EXPIRY = 24 * 60 * 60; // 24 hours

const sessionManager = {
  // Store user session
  async createSession(userId, data) {
    try {
      const sessionKey = `session:${userId}`;
      const success = await redisHelper.set(sessionKey, data, SESSION_EXPIRY);
      return success;
    } catch (error) {
      console.error('Create session error:', error);
      return false;
    }
  },

  // Get user session
  async getSession(userId) {
    try {
      const sessionKey = `session:${userId}`;
      return await redisHelper.get(sessionKey);
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  },

  // Delete user session
  async deleteSession(userId) {
    try {
      const sessionKey = `session:${userId}`;
      return await redisHelper.del(sessionKey);
    } catch (error) {
      console.error('Delete session error:', error);
      return false;
    }
  }
};

module.exports = sessionManager; 