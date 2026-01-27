import jwt from "jsonwebtoken";
import User from "../models/User.js";
import config from "../config/config.js";

const JWT_SECRET = process.env.JWT_SECRET || config.JWT_SECRET;

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    // Validate JWT_SECRET is configured
    if (!JWT_SECRET || JWT_SECRET === "your-secret-key" || JWT_SECRET === "your_jwt_secret_key_here") {
      console.error("⚠️  JWT_SECRET is not properly configured. Using default value.");
      console.error("⚠️  Please set JWT_SECRET in your .env file for production use.");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "Invalid token - user not found" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: "Account is deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    console.error("Error name:", error.name);
    
    // Provide more specific error messages
    if (error.name === "JsonWebTokenError") {
      console.error("⚠️  Token signature verification failed. This usually means:");
      console.error("   1. The token was signed with a different JWT_SECRET");
      console.error("   2. The JWT_SECRET changed since the token was created");
      console.error("   3. Please log out and log back in to get a new token");
      return res.status(403).json({ 
        message: "Invalid token signature. Please log out and log back in.",
        error: "TOKEN_SIGNATURE_INVALID"
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ 
        message: "Token has expired. Please login again.",
        error: "TOKEN_EXPIRED"
      });
    }
    
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export const requireStudent = (req, res, next) => {
  // Allow student, teacher (for backward compatibility), and admin
  if (req.user.role !== "student" && req.user.role !== "admin" && req.user.role !== "teacher") {
    return res.status(403).json({ message: "Student access required" });
  }
  next();
};

// Legacy alias for backward compatibility
export const requireTeacher = requireStudent;
