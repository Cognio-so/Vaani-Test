const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('../lib/passport');

const validateEnv = () => {
  const required = ['JWT_SECRET', 'FRONTEND_URL', 'BACKEND_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  required.forEach(env => {
    if (!process.env[env]) {
      console.error(`Missing environment variable: ${env}`);
      throw new Error(`Missing required environment variable: ${env}`);
    }
  });
};

const Signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    validateEnv();
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
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const Login = async (req, res) => {
  const { email, password } = req.body;

  try {
    validateEnv();
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid password" });

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error("Error in login controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const Logout = async (req, res) => {
  try {
    validateEnv();
    res.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
      path: '/',
      maxAge: 0
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const checkAuth = async (req, res) => {
  try {
    validateEnv();
    if (!req.user) {
      console.error("checkAuth: No user found in request");
      return res.status(401).json({ message: "Not authenticated" });
    }
    console.log("checkAuth: User authenticated:", req.user.email);
    res.status(200).json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email
    });
  } catch (error) {
    console.error("Error in checkAuth controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    validateEnv();
    if (!req.user) {
      console.error("getProfile: No user found in request");
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  } catch (error) {
    console.error("Error in getProfile controller:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    console.log("Token generated and cookie set for userId:", userId);
  } catch (error) {
    console.error("Error in generateToken:", error.stack);
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
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
  }, (err, userObj) => {
    if (err || !userObj || !userObj.token) {
      console.error('Google auth error:', err || 'No user object/token');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    try {
      validateEnv();
      console.log('Google auth success, setting cookie for:', userObj.user.email);
      res.cookie('jwt', userObj.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      const userInfo = encodeURIComponent(JSON.stringify({
        id: userObj.user._id,
        name: userObj.user.name,
        email: userObj.user.email
      }));
      const redirectUrl = `${process.env.FRONTEND_URL}/chat?auth=google&user=${userInfo}`;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google auth callback error:', error.stack);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
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