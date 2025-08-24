// Real Business Search with Social Media APIs Integration
class BusinessSearch {
  constructor() {
    this.dbAPI = dbAPI;
    this.metaAPI = metaAPI;
    this.linkedInAPI = linkedInAPI;
    this.twitterAPI = twitterAPI;
    this.tikTokAPI = tikTokAPI;
    this.cache = new Map();
    this.searchTimeout = null;
    this.cacheTimeout = 1800000; // 30 minutes
  }

  // Real-time search across all platforms
  async searchBusinessProfiles(query, platform = 'all') {
    if (!query || query.trim().length < 2) {
      return { success: true, results: [] };
    }

    const cacheKey = `search_${query.toLowerCase()}_${platform}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Search in database first for existing businesses
      const dbResult = await this.dbAPI.searchBusinesses(query, platform);
      let results = dbResult.success ? dbResult.businesses : [];

      // Search across social media APIs
      const socialResults = await this.searchSocialMediaAPIs(query, platform);
      
      // Merge and deduplicate results
      const mergedResults = this.mergeAndDeduplicateResults(results, socialResults);
      
      // Store new businesses in database
      await this.storeNewBusinesses(socialResults);

      const finalResult = { success: true, results: mergedResults };
      
      // Cache for 30 minutes
      this.setCache(cacheKey, finalResult);
      
      return finalResult;
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  }

  // Search across all social media APIs
  async searchSocialMediaAPIs(query, platform) {
    const searches = [];
    
    try {
      if (platform === 'all' || platform === 'instagram') {
        searches.push(this.metaAPI.searchInstagramBusiness(query));
      }
      
      if (platform === 'all' || platform === 'facebook') {
        searches.push(this.metaAPI.searchFacebookPages(query));
      }
      
      if (platform === 'all' || platform === 'linkedin') {
        searches.push(this.linkedInAPI.searchCompanies(query));
      }
      
      if (platform === 'all' || platform === 'twitter') {
        searches.push(this.twitterAPI.searchBusinessProfiles(query));
      }
      
      if (platform === 'all' || platform === 'tiktok') {
        searches.push(this.tikTokAPI.searchBusinessProfiles(query));
      }

      // Execute all searches in parallel
      const results = await Promise.allSettled(searches);
      
      // Collect successful results
      const socialResults = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          socialResults.push(...result.value);
        } else if (result.status === 'rejected') {
          console.error(`Social media search ${index} failed:`, result.reason);
        }
      });
      
      return socialResults;
    } catch (error) {
      console.error('Social media API search error:', error);
      return [];
    }
  }

  // Merge database and API results, removing duplicates
  mergeAndDeduplicateResults(dbResults, socialResults) {
    const merged = [...dbResults];
    const existingKeys = new Set(dbResults.map(b => `${b.name.toLowerCase()}_${b.platform}`));
    
    socialResults.forEach(business => {
      const key = `${business.name.toLowerCase()}_${business.platform}`;
      if (!existingKeys.has(key)) {
        merged.push(business);
        existingKeys.add(key);
      }
    });
    
    // Sort by relevance (verified first, then by followers/metrics)
    return merged.sort((a, b) => {
      if (a.verified !== b.verified) return b.verified - a.verified;
      
      const aMetric = a.followers || a.fan_count || a.follower_count || 0;
      const bMetric = b.followers || b.fan_count || b.follower_count || 0;
      
      return bMetric - aMetric;
    });
  }

  // Store new businesses found via APIs in database
  async storeNewBusinesses(socialResults) {
    for (const business of socialResults) {
      try {
        await this.dbAPI.createBusiness({
          name: business.name,
          platform: business.platform,
          profile_url: business.profile_url,
          verified: business.verified || false
        });
      } catch (error) {
        // Business might already exist, ignore duplicate errors
        if (!error.message.includes('duplicate')) {
          console.error('Error storing business:', error);
        }
      }
    }
  }

  // Verify business existence across platforms
  async verifyBusiness(businessName, platform) {
    const cacheKey = `verify_${businessName.toLowerCase()}_${platform}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      let verificationResult;
      
      switch (platform) {
        case 'instagram':
          verificationResult = await this.metaAPI.verifyBusiness(businessName, 'instagram');
          break;
        case 'facebook':
          verificationResult = await this.metaAPI.verifyBusiness(businessName, 'facebook');
          break;
        case 'linkedin':
          verificationResult = await this.linkedInAPI.verifyCompany(businessName);
          break;
        case 'twitter':
          verificationResult = await this.twitterAPI.verifyBusiness(businessName);
          break;
        case 'tiktok':
          verificationResult = await this.tikTokAPI.verifyBusiness(businessName);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      
      this.setCache(cacheKey, verificationResult);
      return verificationResult;
    } catch (error) {
      console.error('Business verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Auto-complete suggestions with real API data
  async getAutocompleteSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      // Get suggestions from database first
      const dbResult = await this.dbAPI.searchBusinesses(query);
      let suggestions = [];
      
      if (dbResult.success) {
        suggestions = dbResult.businesses
          .slice(0, limit)
          .map(business => ({
            name: business.name,
            platform: business.platform,
            id: business.id,
            verified: business.verified
          }));
      }
      
      // If we have fewer than limit, try to get more from APIs
      if (suggestions.length < limit) {
        const remaining = limit - suggestions.length;
        const apiSuggestions = await this.getAPISuggestions(query, remaining);
        suggestions.push(...apiSuggestions);
      }
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  // Get suggestions from social media APIs
  async getAPISuggestions(query, limit) {
    try {
      const searches = [
        this.metaAPI.searchInstagramBusiness(query),
        this.linkedInAPI.searchCompanies(query),
        this.twitterAPI.searchBusinessProfiles(query)
      ];
      
      const results = await Promise.allSettled(searches);
      const suggestions = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          result.value.slice(0, Math.ceil(limit / 3)).forEach(business => {
            suggestions.push({
              name: business.name,
              platform: business.platform,
              verified: business.verified,
              source: 'api'
            });
          });
        }
      });
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('API suggestions error:', error);
      return [];
    }
  }

  // Get trending businesses from real API data
  async getTrendingBusinesses(platform = 'all', limit = 10) {
    const cacheKey = `trending_${platform}_${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const trending = [];
      
      // Get database trending first
      const dbTrending = await this.getDBTrendingBusinesses(platform, limit);
      trending.push(...dbTrending);
      
      // Enhance with API data if needed
      if (trending.length < limit) {
        const apiTrending = await this.getAPITrendingBusinesses(platform, limit - trending.length);
        trending.push(...apiTrending);
      }
      
      const result = trending.slice(0, limit);
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error getting trending businesses:', error);
      return [];
    }
  }

  // Get trending from database
  async getDBTrendingBusinesses(platform, limit) {
    try {
      const { data: trendingData, error } = await supabaseClient
        .from('reviews')
        .select(`
          business_id,
          businesses!inner(name, platform, verified),
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const businessCounts = new Map();
      trendingData.forEach(review => {
        const business = review.businesses;
        const key = `${business.name}_${business.platform}`;
        
        if (platform === 'all' || business.platform === platform) {
          businessCounts.set(key, {
            ...business,
            reviewCount: (businessCounts.get(key)?.reviewCount || 0) + 1,
            source: 'database'
          });
        }
      });

      return Array.from(businessCounts.values())
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, limit);
    } catch (error) {
      console.error('DB trending error:', error);
      return [];
    }
  }

  // Get trending from APIs
  async getAPITrendingBusinesses(platform, limit) {
    try {
      const trending = [];
      
      if (platform === 'all' || platform === 'twitter') {
        const twitterTrending = await this.twitterAPI.getTrendingBusinessTopics();
        trending.push(...twitterTrending.map(trend => ({
          name: trend.name,
          platform: 'twitter',
          volume: trend.volume,
          source: 'api'
        })));
      }
      
      if (platform === 'all' || platform === 'tiktok') {
        const tiktokTrending = await this.tikTokAPI.getTrendingHashtags();
        trending.push(...tiktokTrending.map(hashtag => ({
          name: hashtag.name,
          platform: 'tiktok',
          volume: hashtag.publish_count,
          source: 'api'
        })));
      }
      
      return trending.slice(0, limit);
    } catch (error) {
      console.error('API trending error:', error);
      return [];
    }
  }

  // Cache management
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Auto-cleanup cache
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

  // Get API status
  getAPIStatus() {
    return {
      rateLimits: rateLimiter.getAllStatuses(),
      cacheSize: this.cache.size,
      apis: {
        meta: !!socialConfig.apiKeys.meta.accessToken,
        linkedin: !!socialConfig.apiKeys.linkedin.accessToken,
        twitter: !!socialConfig.apiKeys.twitter.bearerToken,
        tiktok: !!socialConfig.apiKeys.tiktok.accessToken
      }
    };
  }
}

// Initialize business search
const businessSearch = new BusinessSearch();