/**
 * Simple API cache utility to improve page load performance
 * Implements TTL (time-to-live) based caching
 */

class APICache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Get cached data if available and not expired
   */
  get(key) {
    if (this.cache.has(key)) {
      const data = this.cache.get(key);
      if (data.expires > Date.now()) {
        console.debug(`Cache HIT: ${key}`);
        return data.value;
      } else {
        // Expired, remove it
        this.cache.delete(key);
        this.timers.delete(key);
      }
    }
    console.debug(`Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set cache with TTL (time-to-live in seconds)
   */
  set(key, value, ttlSeconds = 300) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store data with expiration time
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });

    // Auto cleanup after TTL
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
  }

  /**
   * Clear specific cache key
   */
  clear(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }
}

// Export singleton instance
export const apiCache = new APICache();

/**
 * Hook for cached API calls
 */
export function useCachedAPI(api, endpoint, ttlSeconds = 300) {
  return async (params = {}) => {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    // Try to get from cache
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch and cache
    try {
      const response = await api.get(endpoint, { params });
      apiCache.set(cacheKey, response.data, ttlSeconds);
      return response.data;
    } catch (error) {
      throw error;
    }
  };
}
