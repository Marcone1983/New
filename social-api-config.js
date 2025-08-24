// Social Media APIs Configuration
class SocialAPIConfig {
  constructor() {
    this.apiKeys = {
      meta: {
        appId: process.env.VITE_META_APP_ID || window.ENV?.VITE_META_APP_ID,
        appSecret: process.env.VITE_META_APP_SECRET || window.ENV?.VITE_META_APP_SECRET,
        accessToken: process.env.VITE_META_ACCESS_TOKEN || window.ENV?.VITE_META_ACCESS_TOKEN
      },
      linkedin: {
        clientId: process.env.VITE_LINKEDIN_CLIENT_ID || window.ENV?.VITE_LINKEDIN_CLIENT_ID,
        clientSecret: process.env.VITE_LINKEDIN_CLIENT_SECRET || window.ENV?.VITE_LINKEDIN_CLIENT_SECRET,
        accessToken: process.env.VITE_LINKEDIN_ACCESS_TOKEN || window.ENV?.VITE_LINKEDIN_ACCESS_TOKEN
      },
      twitter: {
        bearerToken: process.env.VITE_TWITTER_BEARER_TOKEN || window.ENV?.VITE_TWITTER_BEARER_TOKEN,
        apiKey: process.env.VITE_TWITTER_API_KEY || window.ENV?.VITE_TWITTER_API_KEY,
        apiSecret: process.env.VITE_TWITTER_API_SECRET || window.ENV?.VITE_TWITTER_API_SECRET
      },
      tiktok: {
        clientKey: process.env.VITE_TIKTOK_CLIENT_KEY || window.ENV?.VITE_TIKTOK_CLIENT_KEY,
        clientSecret: process.env.VITE_TIKTOK_CLIENT_SECRET || window.ENV?.VITE_TIKTOK_CLIENT_SECRET,
        accessToken: process.env.VITE_TIKTOK_ACCESS_TOKEN || window.ENV?.VITE_TIKTOK_ACCESS_TOKEN
      }
    };

    this.endpoints = {
      meta: {
        baseUrl: 'https://graph.facebook.com/v18.0',
        search: '/pages',
        businessSearch: '/search'
      },
      linkedin: {
        baseUrl: 'https://api.linkedin.com/v2',
        companySearch: '/companySearch',
        companies: '/companies'
      },
      twitter: {
        baseUrl: 'https://api.twitter.com/2',
        userByUsername: '/users/by/username',
        search: '/users/search'
      },
      tiktok: {
        baseUrl: 'https://business-api.tiktok.com/open_api/v1.3',
        userInfo: '/user/info',
        search: '/business/get'
      }
    };

    this.rateLimits = {
      meta: { requests: 200, window: 3600000 }, // 200/hour
      linkedin: { requests: 100, window: 3600000 }, // 100/hour  
      twitter: { requests: 300, window: 900000 }, // 300/15min
      tiktok: { requests: 1000, window: 3600000 } // 1000/hour
    };
  }

  validateConfig() {
    const missingKeys = [];
    
    Object.entries(this.apiKeys).forEach(([platform, keys]) => {
      Object.entries(keys).forEach(([key, value]) => {
        if (!value) {
          missingKeys.push(`${platform}.${key}`);
        }
      });
    });

    return {
      valid: missingKeys.length === 0,
      missing: missingKeys
    };
  }
}

const socialConfig = new SocialAPIConfig();