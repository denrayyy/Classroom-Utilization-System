/**
 * World Time API Utility
 * Fetches accurate time from WorldTimeAPI.org
 * Falls back to server time if API is unavailable
 * 
 * To change timezone, set WORLD_TIME_ZONE environment variable
 * Example: WORLD_TIME_ZONE=America/New_York
 * Or use IP-based endpoint: WORLD_TIME_ZONE=ip (uses your IP's timezone)
 * 
 * Available timezones: https://worldtimeapi.org/api/timezone
 */

// Get timezone from environment variable or use default
const TIMEZONE = process.env.WORLD_TIME_ZONE || 'Asia/Manila';
const WORLD_TIME_API_URL = TIMEZONE === 'ip' 
  ? 'https://worldtimeapi.org/api/ip'
  : `https://worldtimeapi.org/api/timezone/${TIMEZONE}`;
const FALLBACK_TIMEOUT = 2000; // 2 seconds timeout for API call

/**
 * Get current time from World Time API
 * @returns {Promise<Date>} Current date/time
 */
export const getWorldTime = async () => {
  try {
    // Try to fetch from World Time API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT);

    const response = await fetch(WORLD_TIME_API_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`World Time API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the datetime from the API response
    // Format: "2024-01-15T10:30:00.123456+08:00"
    const worldTime = new Date(data.datetime);
    
    if (isNaN(worldTime.getTime())) {
      throw new Error('Invalid datetime from World Time API');
    }

    console.log('Time fetched from World Time API:', worldTime.toISOString());
    return worldTime;
  } catch (error) {
    // Fallback to server time if API fails
    if (error.name === 'AbortError') {
      console.warn('World Time API request timed out, using server time');
    } else {
      console.warn('World Time API unavailable, using server time:', error.message);
    }
    
    // Return server's current time as fallback
    return new Date();
  }
};

/**
 * Get current time (synchronized version for immediate use)
 * Uses cached time if available, otherwise fetches from API
 */
let cachedTime = null;
let cacheExpiry = 0;
const CACHE_DURATION = 60000; // Cache for 1 minute

export const getCurrentTime = async () => {
  const now = Date.now();
  
  // Return cached time if still valid
  if (cachedTime && now < cacheExpiry) {
    // Adjust cached time by the elapsed time
    const elapsed = now - (cacheExpiry - CACHE_DURATION);
    return new Date(cachedTime.getTime() + elapsed);
  }

  // Fetch new time from API
  const worldTime = await getWorldTime();
  
  // Cache the time
  cachedTime = worldTime;
  cacheExpiry = now + CACHE_DURATION;
  
  return worldTime;
};

