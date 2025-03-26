const User = require("../model/userModel");
const jwt = require("jsonwebtoken");

const protectRoutes = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined");
      throw new Error("JWT_SECRET is not defined");
    }

    console.log("protectRoutes: Incoming cookies:", req.cookies);
    console.log("protectRoutes: Incoming headers:", {
      authorization: req.headers.authorization,
      'x-auth-token': req.headers['x-auth-token']
    });
    
    let token;
    
    // Check multiple locations for the token
    if (req.cookies.jwt) {
      // 1. First check cookies
      token = req.cookies.jwt;
      console.log("protectRoutes: Found token in cookies");
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // 2. Then check Authorization header
      token = req.headers.authorization.split(' ')[1];
      console.log("protectRoutes: Found token in Authorization header");
    } else if (req.headers['x-auth-token']) {
      // 3. Check custom header
      token = req.headers['x-auth-token'];
      console.log("protectRoutes: Found token in x-auth-token header");
    }

    if (!token) {
      console.error("protectRoutes: No token found in request");
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    console.log("protectRoutes: Verifying token");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("protectRoutes: Token decoded:", decoded);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.error("protectRoutes: User not found for ID:", decoded.userId);
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    console.log("protectRoutes: User set:", user.email);
    
    next();
  } catch (error) {
    console.error("Error in protectRoutes middleware:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired" });
    }
    
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = { protectRoutes };