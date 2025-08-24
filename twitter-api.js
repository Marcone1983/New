// Twitter/X API v2 Integration
class TwitterAPI {
  constructor() {
    this.config = socialConfig.apiKeys.twitter;
    this.endpoints = socialConfig.endpoints.twitter;
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes
  }

  // Search for Twitter business profiles
  async searchBusinessProfiles(query) {
    if (!this.config.bearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }

    const cacheKey = `twitter_search_${query.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('twitter', async () => {
        const url = `${this.endpoints.baseUrl}/users/search`;
        const params = new URLSearchParams({
          query: query,
          max_results: 20,
          'user.fields': 'id,name,username,description,verified,public_metrics,profile_image_url,location,url,created_at'
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      const businesses = this.processTwitterResults(result.data || []);
      
      this.setCache(cacheKey, businesses);
      return businesses;

    } catch (error) {
      console.error('Twitter search error:', error);
      throw error;
    }
  }

  // Get user details by username
  async getUserByUsername(username) {
    if (!this.config.bearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }

    const cacheKey = `twitter_user_${username.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('twitter', async () => {
        const url = `${this.endpoints.baseUrl}/users/by/username/${username}`;
        const params = new URLSearchParams({
          'user.fields': 'id,name,username,description,verified,public_metrics,profile_image_url,location,url,created_at,verified_type'
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result?.data) {
        this.setCache(cacheKey, result.data);
      }
      
      return result?.data || null;

    } catch (error) {
      console.error('Twitter user lookup error:', error);
      throw error;
    }
  }

  // Process Twitter search results
  processTwitterResults(results) {
    return results
      .filter(user => this.isLikelyBusinessAccount(user))
      .map(user => ({
        id: user.id,
        name: user.name,
        platform: 'twitter',
        profile_url: `https://x.com/${user.username}`,
        verified: user.verified || user.verified_type === 'business',
        followers: user.public_metrics?.followers_count || 0,
        following: user.public_metrics?.following_count || 0,
        tweets: user.public_metrics?.tweet_count || 0,
        description: user.description || null,
        location: user.location || null,
        website: user.url || null,
        profile_picture: user.profile_image_url || null,
        created_at: user.created_at || null,
        username: user.username,
        verification_type: user.verified_type || null,
        source: 'twitter_api'
      }));
  }

  // Determine if account is likely a business account
  isLikelyBusinessAccount(user) {
    const businessIndicators = [
      user.verified || user.verified_type === 'business',
      user.public_metrics?.followers_count > 1000,
      user.description?.includes('official') || user.description?.includes('Official'),
      user.description?.includes('company') || user.description?.includes('Company'),
      user.description?.includes('business') || user.description?.includes('Business'),
      user.url !== null,
      user.location !== null
    ];

    // Account is likely business if it has multiple indicators
    const score = businessIndicators.filter(Boolean).length;
    return score >= 2;
  }

  // Verify if a business exists on Twitter
  async verifyBusiness(username) {
    try {
      const user = await this.getUserByUsername(username);
      
      if (user) {
        return {
          exists: true,
          verified: user.verified || user.verified_type === 'business',
          business: this.isLikelyBusinessAccount(user),
          followers: user.public_metrics?.followers_count || 0,
          profile_url: `https://x.com/${username}`,
          details: {
            name: user.name,
            description: user.description,
            location: user.location,
            website: user.url,
            created_at: user.created_at,
            verification_type: user.verified_type
          }
        };
      }
      
      return { exists: false };

    } catch (error) {
      console.error('Twitter verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Search for users by keywords in bio/name
  async searchByKeywords(keywords) {
    if (!this.config.bearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }

    try {
      const searchQuery = keywords.join(' OR ');
      const result = await rateLimiter.makeRequest('twitter', async () => {
        const url = `${this.endpoints.baseUrl}/users/search`;
        const params = new URLSearchParams({
          query: searchQuery,
          max_results: 50,
          'user.fields': 'id,name,username,description,verified,public_metrics,profile_image_url,location,url,verified_type'
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      return this.processTwitterResults(result.data || []);

    } catch (error) {
      console.error('Twitter keyword search error:', error);
      throw error;
    }
  }

  // Get trending business topics
  async getTrendingBusinessTopics(location = 1) { // 1 = Worldwide
    if (!this.config.bearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }

    try {
      const result = await rateLimiter.makeRequest('twitter', async () => {
        const url = `${this.endpoints.baseUrl}/trends/place`;
        const params = new URLSearchParams({
          id: location.toString()
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      // Filter for business-related trends
      const businessTrends = result[0]?.trends?.filter(trend => 
        this.isBusinessRelatedTrend(trend.name)
      ) || [];

      return businessTrends.map(trend => ({
        name: trend.name,
        url: trend.url,
        volume: trend.tweet_volume,
        promoted: trend.promoted_content || null
      }));

    } catch (error) {
      console.error('Twitter trends error:', error);
      throw error;
    }
  }

  // Check if trend is business-related
  isBusinessRelatedTrend(trendName) {
    const businessKeywords = [
      'company', 'business', 'startup', 'enterprise', 'corp', 'inc',
      'tech', 'finance', 'marketing', 'brand', 'product', 'service',
      'retail', 'ecommerce', 'industry', 'market', 'sales'
    ];

    return businessKeywords.some(keyword => 
      trendName.toLowerCase().includes(keyword)
    );
  }

  // Cache management
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
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

const twitterAPI = new TwitterAPI();