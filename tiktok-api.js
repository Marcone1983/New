// TikTok Business API Integration
class TikTokAPI {
  constructor() {
    this.config = socialConfig.apiKeys.tiktok;
    this.endpoints = socialConfig.endpoints.tiktok;
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes
  }

  // Search for TikTok business profiles
  async searchBusinessProfiles(query) {
    if (!this.config.accessToken) {
      throw new Error('TikTok access token not configured');
    }

    const cacheKey = `tiktok_search_${query.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('tiktok', async () => {
        const url = `${this.endpoints.baseUrl}/business/search/`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query,
            count: 20,
            cursor: 0,
            search_type: 'user'
          })
        });

        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result.code !== 0) {
        throw new Error(`TikTok API error: ${result.message}`);
      }

      const businesses = await this.processTikTokResults(result.data?.user_list || []);
      
      this.setCache(cacheKey, businesses);
      return businesses;

    } catch (error) {
      console.error('TikTok search error:', error);
      throw error;
    }
  }

  // Get user information by username
  async getUserInfo(username) {
    if (!this.config.accessToken) {
      throw new Error('TikTok access token not configured');
    }

    const cacheKey = `tiktok_user_${username.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('tiktok', async () => {
        const url = `${this.endpoints.baseUrl}/user/info/`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username
          })
        });

        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result.code !== 0) {
        if (result.code === 40104) return null; // User not found
        throw new Error(`TikTok API error: ${result.message}`);
      }

      if (result.data) {
        this.setCache(cacheKey, result.data);
      }
      
      return result.data || null;

    } catch (error) {
      console.error('TikTok user info error:', error);
      throw error;
    }
  }

  // Process TikTok search results
  async processTikTokResults(results) {
    const businesses = [];
    
    for (const item of results) {
      try {
        // Get detailed user information
        const details = await this.getUserInfo(item.unique_id || item.username);
        
        if (details && this.isLikelyBusinessAccount(details)) {
          businesses.push({
            id: details.open_id || item.open_id,
            name: details.display_name || item.display_name,
            platform: 'tiktok',
            profile_url: `https://www.tiktok.com/@${details.unique_id || item.unique_id}`,
            verified: details.is_verified || false,
            followers: details.follower_count || 0,
            following: details.following_count || 0,
            likes: details.total_favorited || 0,
            videos: details.video_count || 0,
            description: details.bio_description || null,
            avatar: details.avatar_url || details.avatar_larger || null,
            username: details.unique_id || item.unique_id,
            business_account: this.isBusinessAccount(details),
            source: 'tiktok_api'
          });
        }
      } catch (error) {
        console.error(`Error processing TikTok user ${item.unique_id || item.username}:`, error);
      }
    }
    
    return businesses;
  }

  // Determine if account is a business account
  isBusinessAccount(user) {
    // TikTok business accounts have specific indicators
    return user.commerce_user || 
           user.enterprise_verify_reason || 
           user.is_ad_fake === false ||
           user.sec_uid?.includes('business');
  }

  // Determine if account is likely a business account
  isLikelyBusinessAccount(user) {
    const businessIndicators = [
      user.is_verified,
      user.follower_count > 10000,
      user.bio_description?.includes('Official') || user.bio_description?.includes('official'),
      user.bio_description?.includes('Business') || user.bio_description?.includes('business'),
      user.bio_description?.includes('Brand') || user.bio_description?.includes('brand'),
      user.commerce_user,
      user.enterprise_verify_reason,
      user.video_count > 50,
      this.hasBusinessKeywords(user.bio_description)
    ];

    // Account is likely business if it has multiple indicators
    const score = businessIndicators.filter(Boolean).length;
    return score >= 3;
  }

  // Check for business keywords in bio
  hasBusinessKeywords(bio) {
    if (!bio) return false;
    
    const businessKeywords = [
      'company', 'corp', 'inc', 'llc', 'ltd', 'business',
      'official', 'brand', 'shop', 'store', 'service',
      'professional', 'agency', 'studio', 'group'
    ];

    return businessKeywords.some(keyword => 
      bio.toLowerCase().includes(keyword)
    );
  }

  // Verify if a business exists on TikTok
  async verifyBusiness(username) {
    try {
      const user = await this.getUserInfo(username);
      
      if (user) {
        return {
          exists: true,
          verified: user.is_verified || false,
          business: this.isLikelyBusinessAccount(user),
          followers: user.follower_count || 0,
          profile_url: `https://www.tiktok.com/@${username}`,
          details: {
            name: user.display_name,
            description: user.bio_description,
            avatar: user.avatar_url,
            videos: user.video_count,
            likes: user.total_favorited,
            business_account: this.isBusinessAccount(user)
          }
        };
      }
      
      return { exists: false };

    } catch (error) {
      console.error('TikTok verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Get trending hashtags
  async getTrendingHashtags() {
    if (!this.config.accessToken) {
      throw new Error('TikTok access token not configured');
    }

    try {
      const result = await rateLimiter.makeRequest('tiktok', async () => {
        const url = `${this.endpoints.baseUrl}/research/trending/hashtags/`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            region_code: 'US',
            count: 50
          })
        });

        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result.code !== 0) {
        throw new Error(`TikTok API error: ${result.message}`);
      }

      // Filter for business-related hashtags
      const businessHashtags = result.data?.hashtag_list?.filter(hashtag => 
        this.isBusinessRelatedHashtag(hashtag.hashtag_name)
      ) || [];

      return businessHashtags.map(hashtag => ({
        name: hashtag.hashtag_name,
        rank: hashtag.rank,
        publish_count: hashtag.publish_count
      }));

    } catch (error) {
      console.error('TikTok trending hashtags error:', error);
      throw error;
    }
  }

  // Check if hashtag is business-related
  isBusinessRelatedHashtag(hashtagName) {
    const businessKeywords = [
      'business', 'entrepreneur', 'startup', 'company', 'brand',
      'marketing', 'sales', 'finance', 'tech', 'innovation',
      'product', 'service', 'retail', 'ecommerce', 'success'
    ];

    return businessKeywords.some(keyword => 
      hashtagName.toLowerCase().includes(keyword)
    );
  }

  // Search videos by keyword (for business content discovery)
  async searchVideos(keyword, count = 20) {
    if (!this.config.accessToken) {
      throw new Error('TikTok access token not configured');
    }

    try {
      const result = await rateLimiter.makeRequest('tiktok', async () => {
        const url = `${this.endpoints.baseUrl}/research/video/query/`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: {
              and: [
                {
                  operation: 'IN',
                  field_name: 'keyword',
                  field_values: [keyword]
                }
              ]
            },
            max_count: count,
            start_date: '20240101',
            end_date: new Date().toISOString().slice(0, 10).replace(/-/g, '')
          })
        });

        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result.code !== 0) {
        throw new Error(`TikTok API error: ${result.message}`);
      }

      return result.data?.videos || [];

    } catch (error) {
      console.error('TikTok video search error:', error);
      throw error;
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

const tikTokAPI = new TikTokAPI();