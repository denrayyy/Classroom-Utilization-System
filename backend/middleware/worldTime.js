/**
 * World Time Middleware
 * Adds consistent timezone handling to requests
 * Attaches current world time to request object
 */

import { getCurrentTime } from "../utils/worldTimeAPI.js";

/**
 * Middleware to attach world time to request
 * Use this for operations that need consistent timezone handling
 */
export const attachWorldTime = async (req, res, next) => {
  try {
    req.worldTime = await getCurrentTime();
    next();
  } catch (error) {
    console.warn("World time unavailable, using server time:", error.message);
    req.worldTime = new Date();
    next();
  }
};

/**
 * Middleware to attach world time to request without blocking
 * Use this for non-critical operations
 */
export const attachWorldTimeOptional = (req, res, next) => {
  getCurrentTime()
    .then((time) => {
      req.worldTime = time;
      next();
    })
    .catch(() => {
      req.worldTime = new Date();
      next();
    });
};

