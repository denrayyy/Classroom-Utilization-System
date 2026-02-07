// backend/middleware/worldTime.js
import fetch from "node-fetch";

/**
 * Middleware to attach world time to request
 * If World Time API fails, immediately fall back to Manila time
 */
export const attachWorldTime = async (req, res, next) => {
  const TIMEZONE_OFFSET = 8; // Manila is UTC+8

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

    const response = await fetch(
      "https://worldtimeapi.org/api/timezone/Asia/Manila",
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Status ${response.status}`);

    const data = await response.json();
    req.worldTime = new Date(data.datetime);
    next();
  } catch (error) {
    // Immediate fallback to Manila time
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    req.worldTime = new Date(utc + TIMEZONE_OFFSET * 60 * 60000);

    // Optional: log once or use a monitoring service
    console.warn("World Time API unavailable, using Manila time:", error.message);

    next();
  }
};

/**
 * Optional, non-blocking version
 */
export const attachWorldTimeOptional = (req, res, next) => {
  try {
    fetch("https://worldtimeapi.org/api/timezone/Asia/Manila", { timeout: 1000 })
      .then(r => r.json())
      .then(data => { req.worldTime = new Date(data.datetime); })
      .catch(() => {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        req.worldTime = new Date(utc + 8 * 60 * 60000);
      })
      .finally(next);
  } catch {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    req.worldTime = new Date(utc + 8 * 60 * 60000);
    next();
  }
};
