const { Redis } = require('@upstash/redis');

// Create Redis client with Upstash configuration
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Helper functions for common Redis operations
const redisHelper = {
  // Set with expiry
  async set(key, value, expiry = 3600) {
    try {
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      await redis.set(key, value, { ex: expiry });
      return true;
    } catch (error) {
      console.error('Redis SET Error:', error);
      return false;
    }
  },

  // Get and parse if JSON
  async get(key) {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error('Redis GET Error:', error);
      return null;
    }
  },

  // Delete key
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL Error:', error);
      return false;
    }
  },

  // Increment value
  async incr(key) {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Redis INCR Error:', error);
      return 0;
    }
  },

  // Set expiry on key
  async expire(key, seconds) {
    try {
      return await redis.expire(key, seconds);
    } catch (error) {
      console.error('Redis EXPIRE Error:', error);
      return false;
    }
  }
};

// Test the connection
const testConnection = async () => {
  try {
    await redis.ping();
    console.log('Successfully connected to Upstash Redis');
  } catch (error) {
    console.error('Redis connection failed:', error);
  }
};

testConnection();

module.exports = { redis, redisHelper }; 
module.exports = { redis, redisHelper }; 