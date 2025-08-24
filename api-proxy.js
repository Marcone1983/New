// API Proxy Server for Social Media Business Search
// This handles social media searches for all users without requiring individual API keys

class SocialMediaProxy {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
    this.baseUrl = 'https://socialtrust-api.netlify.app/.netlify/functions'; // Your backend
  }

  // Search businesses across social platforms
  async searchBusiness(businessName, platform = 'all') {
    const cacheKey = `${businessName.toLowerCase()}_${platform}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/search-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: businessName,
          platform: platform
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Proxy search error:', error);
      
      // Fallback to public scraping
      return await this.fallbackSearch(businessName, platform);
    }
  }

  // Verify if business exists on platform
  async verifyBusiness(businessName, platform) {
    try {
      const response = await fetch(`${this.baseUrl}/verify-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business: businessName,
          platform: platform
        })
      });

      if (!response.ok) {
        throw new Error(`Verification error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Business verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Fallback to public profile URL checking
  async fallbackSearch(businessName, platform) {
    const results = [];
    const cleanName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const platforms = platform === 'all' 
      ? ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok']
      : [platform];

    for (const plt of platforms) {
      const profileUrl = this.generateProfileUrl(cleanName, plt);
      
      // Check if URL is accessible (indicates profile exists)
      const exists = await this.checkProfileExists(profileUrl);
      
      if (exists) {
        results.push({
          name: businessName,
          platform: plt,
          profile_url: profileUrl,
          verified: false, // Can't determine without API
          source: 'url_check',
          confidence: 0.7 // Lower confidence for URL checking
        });
      }
    }

    return { success: true, results: results };
  }

  // Generate probable profile URLs
  generateProfileUrl(cleanName, platform) {
    const platformUrls = {
      instagram: `https://instagram.com/${cleanName}`,
      facebook: `https://facebook.com/${cleanName}`,
      linkedin: `https://www.linkedin.com/company/${cleanName}`,
      twitter: `https://x.com/${cleanName}`,
      tiktok: `https://www.tiktok.com/@${cleanName}`
    };

    return platformUrls[platform];
  }

  // Check if profile URL is accessible
  async checkProfileExists(url) {
    try {
      // Use a CORS proxy or backend service to check URL
      const response = await fetch(`${this.baseUrl}/check-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      const result = await response.json();
      return result.exists;
    } catch (error) {
      // If proxy fails, assume profile might exist
      return true;
    }
  }

  // Get trending businesses from proxy
  async getTrendingBusinesses(platform = 'all') {
    try {
      const response = await fetch(`${this.baseUrl}/trending-businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platform })
      });

      if (!response.ok) {
        throw new Error(`Trending error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Trending businesses error:', error);
      return { success: true, businesses: [] };
    }
  }

  // Cache management
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    setTimeout(() => this.cache.delete(key), this.cacheTimeout);
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  clearCache() {
    this.cache.clear();
  }
}

// Initialize proxy
const socialProxy = new SocialMediaProxy();