const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('../lib/passport');
const { sendTokens } = require('../lib/utils');
const { redisHelper } = require('../config/redis');
const sessionManager = require('../middleware/sessionManager');

const Signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });

    if (newUser) {
      const { accessToken } = sendTokens(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        token: accessToken
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_DURATION = 15 * 60; // 15 minutes in seconds

const Login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check rate limiting
    const attemptsKey = `login_attempts:${email}`;
    const attempts = await redisHelper.get(attemptsKey) || 0;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return res.status(429).json({ 
        message: "Too many login attempts. Please try again later." 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await redisHelper.incr(attemptsKey);
      await redisHelper.expire(attemptsKey, LOGIN_BLOCK_DURATION);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await redisHelper.incr(attemptsKey);
      await redisHelper.expire(attemptsKey, LOGIN_BLOCK_DURATION);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Reset login attempts on successful login
    await redisHelper.del(attemptsKey);

    // Generate tokens
    const { accessToken, refreshToken } = sendTokens(user._id, res);

    // Store session data in Redis
    await sessionManager.createSession(user._id, {
      userId: user._id,
      email: user.email,
      lastLogin: new Date(),
      accessToken
    });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: accessToken
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const Logout = async (req, res) => {
  try {
    // Get user ID from either req.user or token
    let userId;
    try {
      userId = req.user?._id;
      
      // If userId exists, try to clear Redis session
      if (userId) {
        try {
          await sessionManager.deleteSession(userId);
        } catch (error) {
          console.error('Session deletion error:', error);
          // Continue with logout even if session deletion fails
        }
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
      // Continue with logout even if we can't get the user ID
    }
    
    // Clear cookies regardless of user status
    res.cookie('accessToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0
    });
    
    res.cookie('refreshToken', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0
    });
    
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }
    
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Generate new tokens
      const { accessToken } = sendTokens(user._id, res);
      
      res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: accessToken
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Refresh token expired" });
      }
      throw error;
    }
  } catch (error) {
    console.log("Error in refresh token controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const checkAuth = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in check auth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.log("Error in get profile controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
});

const googleCallback = async (req, res, next) => {
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
  }, async (err, userObj) => {
    if (err || !userObj || !userObj.user) {
      console.error('Google auth error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    try {
      // Generate tokens
      const { accessToken } = sendTokens(userObj.user._id, res);

      // Store session in Redis if available
      try {
        await sessionManager.createSession(userObj.user._id, {
          userId: userObj.user._id,
          email: userObj.user.email,
          lastLogin: new Date(),
          accessToken
        });
      } catch (error) {
        console.error('Session creation error:', error);
      }

      // User agent detection for browser-specific handling
      const userAgent = req.headers['user-agent'] || '';
      const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      // Enhanced error handling for user info
      const userInfo = encodeURIComponent(JSON.stringify({
        _id: userObj.user._id,
        name: userObj.user.name,
        email: userObj.user.email,
        profilePicture: userObj.user.profilePicture,
        token: accessToken
      }));
      
      // Browser-specific URL parameters
      const timestamp = Date.now();
      let redirectUrl = `${process.env.FRONTEND_URL}/chat?auth=google&user=${userInfo}&token=${accessToken}&t=${timestamp}`;
      
      // Special handling for Safari and mobile browsers
      if (isSafari || isMobile) {
        // Use a simpler URL for Safari (which has stricter URL length limits)
        redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?token=${accessToken}&t=${timestamp}`;
      }
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  })(req, res, next);
};

module.exports = { 
  Signup, 
  Login, 
  Logout, 
  refreshToken,
  checkAuth, 
  getProfile, 
  googleAuth,
  googleCallback 
};