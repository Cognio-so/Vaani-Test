const User = require("../model/userModel");
const jwt = require("jsonwebtoken");
const { generateAccessToken } = require("../lib/utils");

const protectRoutes = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;

        if (!accessToken && !refreshToken) {
            return res.status(401).json({ message: "No token, authorization denied" });
        }

        // Check access token first
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
                const user = await User.findById(decoded.userId).select("-password");

                if (!user) {
                    return res.status(401).json({ message: "User not found" });
                }

                req.user = user;
                return next();
            } catch (error) {
                // If access token is invalid but not expired, return error
                if (error.name !== 'TokenExpiredError') {
                    return res.status(401).json({ message: "Invalid token" });
                }
                // If access token is expired, continue to refresh token check
            }
        }

        // If we get here, access token is expired or not present, try refresh token
        if (!refreshToken) {
            return res.status(401).json({ message: "Access token expired, no refresh token" });
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await User.findById(decoded.userId).select("-password");

            if (!user) {
                return res.status(401).json({ message: "User not found" });
            }

            // Generate new access token
            const newAccessToken = generateAccessToken(user._id);
            
            // Set new access token cookie
            res.cookie("accessToken", newAccessToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path: "/",
                maxAge: 15 * 60 * 1000, // 15 minutes
            });

            req.user = user;
            next();
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
        console.log("Error in protectRoutes middleware", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = { protectRoutes };