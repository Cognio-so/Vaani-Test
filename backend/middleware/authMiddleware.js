const User = require("../model/userModel");
const jwt = require("jsonwebtoken");
const { generateAccessToken } = require("../lib/utils");

// Extract token from various sources
const getToken = (req) => {
  // First check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  
  // Then check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  
  // Finally check query params (for redirects from OAuth)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  return null;
};

const protectRoutes = async (req, res, next) => {
  try {
    const token = getToken(req);
    
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Token expired" });
      }
      
      return res.status(401).json({ message: "Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { protectRoutes };