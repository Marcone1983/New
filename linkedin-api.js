// LinkedIn Company API Integration
class LinkedInAPI {
  constructor() {
    this.config = socialConfig.apiKeys.linkedin;
    this.endpoints = socialConfig.endpoints.linkedin;
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes
  }

  // Search for LinkedIn companies
  async searchCompanies(query) {
    if (!this.config.accessToken) {
      throw new Error('LinkedIn access token not configured');
    }

    const cacheKey = `linkedin_search_${query.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('linkedin', async () => {
        const url = `${this.endpoints.baseUrl}/companySearch`;
        const params = new URLSearchParams({
          q: 'keywords',
          keywords: query,
          start: 0,
          count: 20
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        if (!response.ok) {
          throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      const businesses = await this.processLinkedInResults(result.elements || []);
      
      this.setCache(cacheKey, businesses);
      return businesses;

    } catch (error) {
      console.error('LinkedIn company search error:', error);
      throw error;
    }
  }

  // Get company details by company ID
  async getCompanyDetails(companyId) {
    if (!this.config.accessToken) {
      throw new Error('LinkedIn access token not configured');
    }

    const cacheKey = `linkedin_company_${companyId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const result = await rateLimiter.makeRequest('linkedin', async () => {
        const url = `${this.endpoints.baseUrl}/companies/${companyId}`;
        const params = new URLSearchParams({
          projection: '(id,name,universalName,description,website,industries,locations,logoV2,staffCount,foundedOn,specialties,followerCount)'
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      if (result) {
        this.setCache(cacheKey, result);
      }
      
      return result;

    } catch (error) {
      console.error('LinkedIn company details error:', error);
      throw error;
    }
  }

  // Process LinkedIn search results
  async processLinkedInResults(results) {
    const businesses = [];
    
    for (const item of results) {
      try {
        // Get detailed company information
        const details = await this.getCompanyDetails(item.id);
        
        if (details) {
          businesses.push({
            id: details.id,
            name: details.name,
            platform: 'linkedin',
            profile_url: `https://www.linkedin.com/company/${details.universalName || details.id}`,
            verified: true, // LinkedIn companies are inherently verified
            followers: details.followerCount || 0,
            employees: this.parseStaffCount(details.staffCount),
            industry: details.industries?.[0]?.localizedName || null,
            description: details.description || null,
            website: details.website || null,
            founded: details.foundedOn?.year || null,
            specialties: details.specialties || [],
            logo: this.extractLogoUrl(details.logoV2),
            locations: this.extractLocations(details.locations),
            source: 'linkedin_api'
          });
        }
      } catch (error) {
        console.error(`Error processing LinkedIn company ${item.id}:`, error);
      }
    }
    
    return businesses;
  }

  // Parse staff count from LinkedIn format
  parseStaffCount(staffCount) {
    if (!staffCount) return 0;
    
    const ranges = {
      'SIZE_1': 1,
      'SIZE_2_TO_10': 5,
      'SIZE_11_TO_50': 30,
      'SIZE_51_TO_200': 125,
      'SIZE_201_TO_500': 350,
      'SIZE_501_TO_1000': 750,
      'SIZE_1001_TO_5000': 3000,
      'SIZE_5001_TO_10000': 7500,
      'SIZE_10001_PLUS': 15000
    };
    
    return ranges[staffCount] || 0;
  }

  // Extract logo URL from LinkedIn logoV2 object
  extractLogoUrl(logoV2) {
    if (!logoV2 || !logoV2.cropped) return null;
    
    try {
      const artifacts = logoV2.cropped.artifacts;
      if (artifacts && artifacts.length > 0) {
        // Return the largest available logo
        const largest = artifacts.reduce((prev, current) => 
          (prev.width > current.width) ? prev : current
        );
        return largest.fileIdentifyingUrlPathSegment;
      }
    } catch (error) {
      console.error('Error extracting logo URL:', error);
    }
    
    return null;
  }

  // Extract locations from LinkedIn locations array
  extractLocations(locations) {
    if (!locations || !locations.elements) return [];
    
    return locations.elements.map(location => ({
      country: location.country,
      city: location.city,
      postalCode: location.postalCode,
      description: location.description
    }));
  }

  // Verify if a company exists on LinkedIn
  async verifyCompany(companyName) {
    try {
      const searchResults = await this.searchCompanies(companyName);
      const exactMatch = searchResults.find(company => 
        company.name.toLowerCase() === companyName.toLowerCase()
      );
      
      if (exactMatch) {
        return {
          exists: true,
          verified: true,
          company: exactMatch,
          profile_url: exactMatch.profile_url
        };
      }
      
      return { exists: false };

    } catch (error) {
      console.error('LinkedIn company verification error:', error);
      return { exists: false, error: error.message };
    }
  }

  // Search companies by domain
  async searchByDomain(domain) {
    if (!this.config.accessToken) {
      throw new Error('LinkedIn access token not configured');
    }

    try {
      const result = await rateLimiter.makeRequest('linkedin', async () => {
        const url = `${this.endpoints.baseUrl}/companySearch`;
        const params = new URLSearchParams({
          q: 'website',
          website: domain
        });

        const response = await fetch(`${url}?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        if (!response.ok) {
          throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      return await this.processLinkedInResults(result.elements || []);

    } catch (error) {
      console.error('LinkedIn domain search error:', error);
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

const linkedInAPI = new LinkedInAPI();