// Business Search with Proxy API (no user API keys required)
class BusinessSearch {
  constructor() {
    this.dbAPI = dbAPI;
    this.socialProxy = socialProxy;
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
      // Search in Supabase database first for existing businesses
      console.log('🔍 Searching in database for:', query);
      const dbResult = await this.searchInDatabase(query, platform);
      let results = dbResult.success ? dbResult.businesses : [];

      // If no results in database, use Sherlock OSINT to search 400+ social networks
      if (results.length === 0) {
        console.log('🕵️ No results in database, using Sherlock OSINT for:', query);
        const sherlockResults = await this.searchWithSherlock(query, platform);
        results = sherlockResults.success ? sherlockResults.results : [];
        
        // Store any new businesses found via Sherlock in database
        if (results.length > 0) {
          await this.storeSherlockResults(results);
        }
      }
      
      const finalResult = { 
        success: true, 
        results: results.slice(0, 10), // Limit to 10 results
        source: results.length > 0 ? (results[0].source === 'sherlock_osint' ? 'sherlock' : 'database') : 'none'
      };
      
      // Cache for 30 minutes
      this.setCache(cacheKey, finalResult);
      
      return finalResult;
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  // Search directly in Supabase database
  async searchInDatabase(query, platform = 'all') {
    try {
      let queryBuilder = supabase
        .from('businesses')
        .select('*')
        .ilike('name', `%${query}%`);

      if (platform && platform !== 'all') {
        queryBuilder = queryBuilder.eq('platform', platform);
      }

      const { data, error } = await queryBuilder
        .order('name')
        .limit(10);
      
      if (error) throw error;

      // Transform results to expected format
      const businesses = (data || []).map(business => ({
        id: business.id,
        name: business.name,
        platform: business.platform,
        profile_url: business.profile_url,
        verified: business.verified,
        source: 'database',
        confidence: 1.0,
        description: business.description || null,
        follower_count: business.follower_count || 0
      }));

      console.log(`✅ Found ${businesses.length} businesses in database`);
      return { success: true, businesses };
    } catch (error) {
      console.error('Database search error:', error);
      return { success: false, error: error.message, businesses: [] };
    }
  }

  // Search with Sherlock OSINT (400+ social networks)
  async searchWithSherlock(query, platform = 'all') {
    try {
      console.log('🔍 Calling Sherlock OSINT for:', query);
      
      const response = await fetch('/.netlify/functions/sherlock-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          platforms: platform === 'all' ? null : [platform] 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Sherlock API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Sherlock found ${result.results.length} profiles`);
        return {
          success: true,
          results: result.results.map(profile => ({
            id: profile.id,
            name: profile.name,
            platform: profile.platform,
            profile_url: profile.profile_url || profile.url,
            verified: profile.verified || false,
            source: 'sherlock_osint',
            confidence: profile.confidence || 0.8,
            username: profile.username,
            relevance_score: profile.relevance_score || 50
          }))
        };
      } else {
        console.log('❌ Sherlock search failed:', result.error);
        return { success: false, results: [] };
      }
      
    } catch (error) {
      console.error('Sherlock OSINT error:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  // Store Sherlock results in database for future searches
  async storeSherlockResults(sherlockResults) {
    console.log('💾 Storing Sherlock results in database...');
    
    for (const result of sherlockResults) {
      try {
        const businessData = {
          name: result.name,
          platform: result.platform,
          profile_url: result.profile_url,
          verified: result.verified || false,
          description: `Found via OSINT search - confidence: ${result.confidence}`
        };

        const { error } = await supabase
          .from('businesses')
          .upsert([businessData], { 
            onConflict: 'name,platform',
            ignoreDuplicates: true 
          });

        if (!error) {
          console.log(`✅ Stored ${result.name} on ${result.platform}`);
        }
      } catch (error) {
        console.error('Error storing Sherlock result:', error);
      }
    }
  }

  // Verify business via proxy
  async verifyBusinessViaProxy(businessName, platform) {
    try {
      return await this.socialProxy.verifyBusiness(businessName, platform);
    } catch (error) {
      console.error('Proxy verification error:', error);
      return { exists: false, error: error.message };
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

  // Verify business existence via proxy
  async verifyBusiness(businessName, platform) {
    const cacheKey = `verify_${businessName.toLowerCase()}_${platform}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const verificationResult = await this.socialProxy.verifyBusiness(businessName, platform);
      this.setCache(cacheKey, verificationResult);
      return verificationResult;
    } catch (error) {
      console.error('Business verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Auto-complete suggestions with database + generated profiles
  async getAutocompleteSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      // Get suggestions from database first
      const dbResult = await this.searchInDatabase(query, 'all');
      let suggestions = [];
      
      if (dbResult.success && dbResult.businesses.length > 0) {
        suggestions = dbResult.businesses
          .slice(0, limit)
          .map(business => ({
            name: business.name,
            platform: business.platform,
            profile_url: business.profile_url,
            id: business.id,
            verified: business.verified,
            source: 'database'
          }));
      }
      
      // If we have fewer than limit, try Sherlock OSINT
      if (suggestions.length < limit) {
        const remaining = limit - suggestions.length;
        const sherlockResult = await this.searchWithSherlock(query, 'all');
        
        if (sherlockResult.success) {
          const sherlockSuggestions = sherlockResult.results
            .slice(0, remaining)
            .map(profile => ({
              name: profile.name,
              platform: profile.platform,
              profile_url: profile.profile_url,
              id: profile.id,
              verified: profile.verified,
              source: 'sherlock_osint'
            }));
          suggestions.push(...sherlockSuggestions);
        }
      }
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  // Get suggestions from proxy API
  async getAPISuggestions(query, limit) {
    try {
      const proxyResult = await this.socialProxy.searchBusiness(query, 'all');
      
      if (proxyResult.success) {
        return proxyResult.results.slice(0, limit).map(business => ({
          name: business.name,
          platform: business.platform,
          verified: business.verified,
          source: business.source || 'api'
        }));
      }
      
      return [];
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
      const { data: trendingData, error } = await supabase
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

  // Get trending from proxy API
  async getAPITrendingBusinesses(platform, limit) {
    try {
      const trendingResult = await this.socialProxy.getTrendingBusinesses(platform);
      
      if (trendingResult.success) {
        return trendingResult.businesses.slice(0, limit);
      }
      
      return [];
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

  // Get proxy API status
  getAPIStatus() {
    return {
      proxyEnabled: true,
      cacheSize: this.cache.size,
      lastCheck: new Date().toISOString(),
      features: {
        businessSearch: true,
        profileVerification: true,
        trendingAnalysis: true,
        multiPlatform: true
      }
    };
  }
}

// Initialize business search
const businessSearch = new BusinessSearch();