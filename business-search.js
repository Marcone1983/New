// Business Search Integration
class BusinessSearch {
  constructor() {
    this.dbAPI = dbAPI;
    this.cache = new Map();
    this.searchTimeout = null;
  }

  // Real-time search with debouncing
  async searchBusinessProfiles(query, platform = 'all') {
    if (!query || query.trim().length < 2) {
      return { success: true, results: [] };
    }

    const cacheKey = `${query.toLowerCase()}_${platform}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Search in database first
      const dbResult = await this.dbAPI.searchBusinesses(query, platform);
      
      if (dbResult.success) {
        // Enhance with social media profile discovery
        const enhancedResults = await this.enhanceWithSocialProfiles(
          dbResult.businesses, 
          query, 
          platform
        );

        const result = { success: true, results: enhancedResults };
        
        // Cache for 5 minutes
        this.cache.set(cacheKey, result);
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
        
        return result;
      }
      
      return dbResult;
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhance results with social media profile discovery
  async enhanceWithSocialProfiles(businesses, query, platform) {
    const enhanced = [...businesses];
    
    // If we have few results, try to discover new profiles
    if (enhanced.length < 5) {
      const discoveredProfiles = await this.discoverSocialProfiles(query, platform);
      enhanced.push(...discoveredProfiles);
    }

    return enhanced;
  }

  // Discover social media profiles (mock implementation)
  async discoverSocialProfiles(query, platform) {
    // This would integrate with social media APIs in production
    // For now, we'll create mock suggestions based on common patterns
    
    const suggestions = [];
    const platforms = platform === 'all' 
      ? ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok']
      : [platform];

    for (const plt of platforms) {
      const mockProfile = {
        id: `mock_${plt}_${Date.now()}`,
        name: query,
        platform: plt,
        profile_url: this.generateProfileUrl(query, plt),
        verified: false,
        created_at: new Date().toISOString(),
        suggested: true // Mark as suggested
      };
      
      suggestions.push(mockProfile);
    }

    return suggestions;
  }

  // Generate probable profile URLs
  generateProfileUrl(businessName, platform) {
    const cleanName = businessName.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);

    const platformUrls = {
      instagram: `https://instagram.com/${cleanName}`,
      facebook: `https://facebook.com/${cleanName}`,
      linkedin: `https://www.linkedin.com/company/${cleanName}`,
      twitter: `https://x.com/${cleanName}`,
      tiktok: `https://www.tiktok.com/@${cleanName}`
    };

    return platformUrls[platform] || '#';
  }

  // Auto-complete suggestions
  async getAutocompleteSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 1) {
      return [];
    }

    try {
      const result = await this.dbAPI.searchBusinesses(query);
      
      if (result.success) {
        return result.businesses
          .slice(0, limit)
          .map(business => ({
            name: business.name,
            platform: business.platform,
            id: business.id
          }));
      }
      
      return [];
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  // Trending businesses
  async getTrendingBusinesses(platform = 'all', limit = 10) {
    try {
      // Get businesses with most recent reviews
      const { data: trendingData, error } = await supabaseClient
        .from('reviews')
        .select(`
          business_id,
          businesses!inner(name, platform),
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by business and count
      const businessCounts = new Map();
      trendingData.forEach(review => {
        const business = review.businesses;
        const key = `${business.name}_${business.platform}`;
        
        if (platform === 'all' || business.platform === platform) {
          businessCounts.set(key, {
            ...business,
            reviewCount: (businessCounts.get(key)?.reviewCount || 0) + 1
          });
        }
      });

      return Array.from(businessCounts.values())
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting trending businesses:', error);
      return [];
    }
  }

  // Clear search cache
  clearCache() {
    this.cache.clear();
  }
}

// Initialize business search
const businessSearch = new BusinessSearch();