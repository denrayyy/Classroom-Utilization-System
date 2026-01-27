/**
 * Database Ready Middleware
 * Ensures MongoDB connection is established before handling requests
 */

import mongoose from "mongoose";

/**
 * Middleware to check if database is connected
 * Returns 503 Service Unavailable if database is not ready
 */
export const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    // Connected
    next();
  } else if (mongoose.connection.readyState === 2) {
    // Connecting - wait a bit
    mongoose.connection.once("connected", () => next());
    // Timeout after 5 seconds
    setTimeout(() => {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          message: "Database connection in progress. Please try again in a moment.",
        });
      }
    }, 5000);
  } else {
    // Not connected (0 = disconnected, 3 = disconnecting)
    return res.status(503).json({
      message: "Database is not available. Please check the connection and try again.",
      details: process.env.NODE_ENV === "development" 
        ? `Connection state: ${mongoose.connection.readyState}` 
        : undefined,
    });
  }
};

