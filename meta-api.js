// Meta (Facebook/Instagram) Business API Integration
class MetaAPI {
  constructor() {
    this.config = socialConfig.apiKeys.meta;
    this.endpoints = socialConfig.endpoints.meta;
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes
  }

  // Search for Instagram business accounts
  async searchInstagramBusiness(query) {
    if (!this.config.accessToken) {
      throw new Error('Meta access token not configured');
    }

    const cacheKey = `ig_search_${query.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('meta', async () => {
        const url = `${this.endpoints.baseUrl}/ig_hashtag_search`;
        const params = new URLSearchParams({
          q: query,
          access_token: this.config.accessToken
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`Meta API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      // Process Instagram business search results
      const businesses = await this.processInstagramResults(result.data || []);
      
      this.setCache(cacheKey, businesses);
      return businesses;

    } catch (error) {
      console.error('Instagram business search error:', error);
      throw error;
    }
  }

  // Search for Facebook pages
  async searchFacebookPages(query) {
    if (!this.config.accessToken) {
      throw new Error('Meta access token not configured');
    }

    const cacheKey = `fb_search_${query.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('meta', async () => {
        const url = `${this.endpoints.baseUrl}/pages/search`;
        const params = new URLSearchParams({
          q: query,
          type: 'page',
          fields: 'id,name,category,verification_status,link,picture,fan_count,about',
          access_token: this.config.accessToken
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`Meta API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      const businesses = this.processFacebookResults(result.data || []);
      
      this.setCache(cacheKey, businesses);
      return businesses;

    } catch (error) {
      console.error('Facebook pages search error:', error);
      throw error;
    }
  }

  // Process Instagram search results
  async processInstagramResults(results) {
    const businesses = [];
    
    for (const item of results) {
      if (item.id) {
        try {
          // Get detailed business info
          const details = await this.getInstagramBusinessDetails(item.id);
          if (details) {
            businesses.push({
              id: item.id,
              name: details.name || details.username,
              platform: 'instagram',
              profile_url: `https://instagram.com/${details.username}`,
              verified: details.is_verified || false,
              followers: details.followers_count || 0,
              category: details.category || null,
              bio: details.biography || null,
              website: details.website || null,
              profile_picture: details.profile_picture_url || null,
              business_account: details.account_type === 'BUSINESS',
              source: 'meta_api'
            });
          }
        } catch (error) {
          console.error(`Error getting Instagram details for ${item.id}:`, error);
        }
      }
    }
    
    return businesses;
  }

  // Process Facebook search results
  processFacebookResults(results) {
    return results.map(page => ({
      id: page.id,
      name: page.name,
      platform: 'facebook',
      profile_url: page.link || `https://facebook.com/${page.id}`,
      verified: page.verification_status === 'blue_verified' || false,
      followers: page.fan_count || 0,
      category: page.category || null,
      about: page.about || null,
      profile_picture: page.picture?.data?.url || null,
      source: 'meta_api'
    }));
  }

  // Get detailed Instagram business information
  async getInstagramBusinessDetails(businessId) {
    try {
      const result = await rateLimiter.makeRequest('meta', async () => {
        const url = `${this.endpoints.baseUrl}/${businessId}`;
        const params = new URLSearchParams({
          fields: 'id,username,name,biography,website,followers_count,media_count,profile_picture_url,account_type,is_verified,category',
          access_token: this.config.accessToken
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`Meta API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      return result;
    } catch (error) {
      console.error('Error getting Instagram business details:', error);
      return null;
    }
  }

  // Verify if a business exists on platform
  async verifyBusiness(username, platform) {
    try {
      if (platform === 'instagram') {
        return await this.verifyInstagramBusiness(username);
      } else if (platform === 'facebook') {
        return await this.verifyFacebookPage(username);
      }
      return null;
    } catch (error) {
      console.error('Business verification error:', error);
      return null;
    }
  }

  // Verify Instagram business
  async verifyInstagramBusiness(username) {
    try {
      const result = await rateLimiter.makeRequest('meta', async () => {
        const url = `${this.endpoints.baseUrl}/${username}`;
        const params = new URLSearchParams({
          fields: 'id,username,name,account_type,is_verified,followers_count',
          access_token: this.config.accessToken
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Meta API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      return result ? {
        exists: true,
        verified: result.is_verified || false,
        business: result.account_type === 'BUSINESS',
        followers: result.followers_count || 0,
        profile_url: `https://instagram.com/${username}`
      } : { exists: false };

    } catch (error) {
      console.error('Instagram verification error:', error);
      return { exists: false, error: error.message };
    }
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

const metaAPI = new MetaAPI();