// Professional Rate Limiter for Social Media APIs
class RateLimiter {
  constructor() {
    this.limits = new Map();
    this.queues = new Map();
    this.processing = new Map();
  }

  // Initialize rate limiting for a platform
  init(platform, maxRequests, windowMs) {
    if (!this.limits.has(platform)) {
      this.limits.set(platform, {
        max: maxRequests,
        window: windowMs,
        requests: [],
        queue: [],
        processing: false
      });
    }
  }

  // Check if request can be made immediately
  canMakeRequest(platform) {
    const limit = this.limits.get(platform);
    if (!limit) return false;

    const now = Date.now();
    const windowStart = now - limit.window;
    
    // Remove expired requests
    limit.requests = limit.requests.filter(time => time > windowStart);
    
    return limit.requests.length < limit.max;
  }

  // Add request to rate limiter
  async makeRequest(platform, requestFn) {
    return new Promise((resolve, reject) => {
      const limit = this.limits.get(platform);
      if (!limit) {
        reject(new Error(`Rate limiter not initialized for platform: ${platform}`));
        return;
      }

      const requestItem = {
        fn: requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      };

      if (this.canMakeRequest(platform)) {
        this.executeRequest(platform, requestItem);
      } else {
        // Queue the request
        limit.queue.push(requestItem);
        this.processQueue(platform);
      }
    });
  }

  // Execute a request immediately
  async executeRequest(platform, requestItem) {
    const limit = this.limits.get(platform);
    const now = Date.now();
    
    try {
      limit.requests.push(now);
      const result = await requestItem.fn();
      requestItem.resolve(result);
    } catch (error) {
      requestItem.reject(error);
    }
  }

  // Process queued requests
  async processQueue(platform) {
    const limit = this.limits.get(platform);
    if (limit.processing || limit.queue.length === 0) return;
    
    limit.processing = true;
    
    while (limit.queue.length > 0) {
      if (this.canMakeRequest(platform)) {
        const request = limit.queue.shift();
        await this.executeRequest(platform, request);
      } else {
        // Wait until next available slot
        const oldestRequest = Math.min(...limit.requests);
        const waitTime = (oldestRequest + limit.window) - Date.now();
        
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    limit.processing = false;
  }

  // Get current rate limit status
  getStatus(platform) {
    const limit = this.limits.get(platform);
    if (!limit) return null;

    const now = Date.now();
    const windowStart = now - limit.window;
    const activeRequests = limit.requests.filter(time => time > windowStart).length;
    
    return {
      platform,
      used: activeRequests,
      remaining: limit.max - activeRequests,
      total: limit.max,
      resetTime: windowStart + limit.window,
      queueLength: limit.queue.length
    };
  }

  // Get all statuses
  getAllStatuses() {
    const statuses = {};
    for (const platform of this.limits.keys()) {
      statuses[platform] = this.getStatus(platform);
    }
    return statuses;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Initialize rate limits for all platforms
rateLimiter.init('meta', 200, 3600000);      // 200/hour
rateLimiter.init('linkedin', 100, 3600000);  // 100/hour
rateLimiter.init('twitter', 300, 900000);    // 300/15min  
rateLimiter.init('tiktok', 1000, 3600000);   // 1000/hour