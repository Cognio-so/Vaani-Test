const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('../lib/passport');

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
    await newUser.save();

    // Generate token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });
    
    // Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    // Also send token in header and body
    res.set('x-auth-token', token);

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      token: token // Include token in response body
    });
  } catch (error) {
    console.error("Error in signup controller:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const Login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid password" });

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });
    
    // Set cookie (may or may not work across domains)
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    // Also send token in header and body (guaranteed to work)
    res.set('x-auth-token', token);
    
    // Return user data
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: token // Include token in response body
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const Logout = async (req, res) => {
  try {
    res.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
      path: '/',
      maxAge: 0
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const checkAuth = async (req, res) => {
  try {
    if (!req.user) {
      console.log("checkAuth: No user in request object");
      return res.status(401).json({ message: "Not authenticated" });
    }
    console.log("checkAuth: User authenticated successfully:", req.user.email);
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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

const generateToken = (userId, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }
    
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });
    
    // Use consistent cookie settings across the application
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    console.log("Token generated and cookie set for userId:", userId);
    return token;
  } catch (error) {
    console.error("Error in generateToken:", error);
    throw error;
  }
};

const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
});

const googleCallback = async (req, res, next) => {
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'https://vanni-test-frontend.vercel.app'}/login?error=auth_failed`
  }, (err, userObj) => {
    if (err || !userObj || !userObj.token) {
      console.error('Google auth error:', err);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://vanni-test-frontend.vercel.app'}/login?error=auth_failed`);
    }

    try {
      // Set cookie
      res.cookie('jwt', userObj.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      // Pass along user info AND token in the URL
      const userInfo = encodeURIComponent(JSON.stringify({
        _id: userObj.user._id,
        name: userObj.user.name,
        email: userObj.user.email
      }));
      
      const redirectUrl = `${process.env.FRONTEND_URL || 'https://vanni-test-frontend.vercel.app'}/chat?auth=google&user=${userInfo}&token=${userObj.token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'https://vanni-test-frontend.vercel.app'}/login?error=auth_failed`);
    }
  })(req, res, next);
};

module.exports = { 
  Signup, 
  Login, 
  Logout, 
  checkAuth, 
  getProfile, 
  googleAuth,
  googleCallback 
};