const User = require("../model/userModel");
const jwt = require("jsonwebtoken");

const protectRoutes = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined");
      throw new Error("JWT_SECRET is not defined");
    }

    // Log the full cookie object and headers
    console.log("protectRoutes: Incoming cookies:", req.cookies);
    console.log("protectRoutes: Headers:", req.headers);
    
    const token = req.cookies.jwt;

    if (!token) {
      console.error("protectRoutes: No JWT token found in cookies");
      // Try to get token from Authorization header as fallback
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const headerToken = authHeader.split(' ')[1];
        console.log("protectRoutes: Found token in Authorization header");
        req.token = headerToken;
      } else {
        return res.status(401).json({ message: "No token, authorization denied" });
      }
    } else {
      req.token = token;
    }

    console.log("protectRoutes: Verifying token");
    const decoded = jwt.verify(req.token, process.env.JWT_SECRET);
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
    console.error("Error in protectRoutes middleware:", error.stack);
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