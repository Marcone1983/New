// Netlify Function: Search Business Across Social Platforms
// This runs on your backend with your API keys - users don't need their own keys

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { query, platform = 'all' } = JSON.parse(event.body);
    
    if (!query || query.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    // STEP 1.5: Try Sherlock OSINT as primary search method
    console.log('🕵️ Attempting Sherlock OSINT search for:', query);
    try {
      const sherlockResponse = await fetch(`${process.env.URL}/.netlify/functions/sherlock-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, platforms: platform === 'all' ? null : [platform] })
      });
      
      if (sherlockResponse.ok) {
        const sherlockData = await sherlockResponse.json();
        if (sherlockData.success && sherlockData.results.length > 0) {
          console.log('✅ Sherlock found profiles, returning OSINT results');
          return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({
              ...sherlockData,
              message: 'OSINT results from Sherlock'
            })
          };
        }
      }
    } catch (error) {
      console.log('⚠️ Sherlock search failed, falling back to APIs:', error.message);
    }

    // Your API keys stored as Netlify environment variables
    const apiKeys = {
      meta: process.env.META_ACCESS_TOKEN,
      linkedin: process.env.LINKEDIN_ACCESS_TOKEN,
      twitter: process.env.TWITTER_BEARER_TOKEN,
      tiktok: process.env.TIKTOK_ACCESS_TOKEN
    };

    const results = [];

    // Search Instagram if Meta token available
    if ((platform === 'all' || platform === 'instagram') && apiKeys.meta) {
      try {
        const instagramResults = await searchInstagram(query, apiKeys.meta);
        results.push(...instagramResults);
      } catch (error) {
        console.error('Instagram search error:', error);
      }
    }

    // Search Facebook if Meta token available
    if ((platform === 'all' || platform === 'facebook') && apiKeys.meta) {
      try {
        const facebookResults = await searchFacebook(query, apiKeys.meta);
        results.push(...facebookResults);
      } catch (error) {
        console.error('Facebook search error:', error);
      }
    }

    // Search LinkedIn if token available
    if ((platform === 'all' || platform === 'linkedin') && apiKeys.linkedin) {
      try {
        const linkedinResults = await searchLinkedIn(query, apiKeys.linkedin);
        results.push(...linkedinResults);
      } catch (error) {
        console.error('LinkedIn search error:', error);
      }
    }

    // Search Twitter if token available
    if ((platform === 'all' || platform === 'twitter') && apiKeys.twitter) {
      try {
        const twitterResults = await searchTwitter(query, apiKeys.twitter);
        results.push(...twitterResults);
      } catch (error) {
        console.error('Twitter search error:', error);
      }
    }

    // Search TikTok if token available
    if ((platform === 'all' || platform === 'tiktok') && apiKeys.tiktok) {
      try {
        const tiktokResults = await searchTikTok(query, apiKeys.tiktok);
        results.push(...tiktokResults);
      } catch (error) {
        console.error('TikTok search error:', error);
      }
    }

    // If no API results, provide URL-based suggestions
    if (results.length === 0) {
      const fallbackResults = generateFallbackResults(query, platform);
      results.push(...fallbackResults);
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        query: query,
        platform: platform,
        results: results.slice(0, 20), // Limit to 20 results
        cached: false
      })
    };

  } catch (error) {
    console.error('Search function error:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

// Search Instagram Business accounts
async function searchInstagram(query, accessToken) {
  const url = `https://graph.facebook.com/v18.0/ig_hashtag_search?q=${encodeURIComponent(query)}&access_token=${accessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map(item => ({
      id: item.id,
      name: item.name || query,
      platform: 'instagram',
      profile_url: `https://instagram.com/${query.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      verified: false,
      source: 'meta_api'
    }));
  } catch (error) {
    console.error('Instagram API error:', error);
    return [];
  }
}

// Search Facebook Pages
async function searchFacebook(query, accessToken) {
  const url = `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(query)}&type=page&fields=id,name,verification_status,link&access_token=${accessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.data || []).map(page => ({
      id: page.id,
      name: page.name,
      platform: 'facebook',
      profile_url: page.link || `https://facebook.com/${page.id}`,
      verified: page.verification_status === 'blue_verified',
      source: 'meta_api'
    }));
  } catch (error) {
    console.error('Facebook API error:', error);
    return [];
  }
}

// Search LinkedIn Companies
async function searchLinkedIn(query, accessToken) {
  const url = `https://api.linkedin.com/v2/companySearch?q=keywords&keywords=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    
    const data = await response.json();
    
    return (data.elements || []).map(company => ({
      id: company.id,
      name: company.name,
      platform: 'linkedin',
      profile_url: `https://www.linkedin.com/company/${company.universalName || company.id}`,
      verified: true,
      source: 'linkedin_api'
    }));
  } catch (error) {
    console.error('LinkedIn API error:', error);
    return [];
  }
}

// Search Twitter Business profiles
async function searchTwitter(query, bearerToken) {
  const url = `https://api.twitter.com/2/users/search?query=${encodeURIComponent(query)}&max_results=20&user.fields=verified,public_metrics`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`
      }
    });
    
    const data = await response.json();
    
    return (data.data || []).map(user => ({
      id: user.id,
      name: user.name,
      platform: 'twitter',
      profile_url: `https://x.com/${user.username}`,
      verified: user.verified,
      followers: user.public_metrics?.followers_count || 0,
      source: 'twitter_api'
    }));
  } catch (error) {
    console.error('Twitter API error:', error);
    return [];
  }
}

// Search TikTok Business accounts
async function searchTikTok(query, accessToken) {
  const url = `https://business-api.tiktok.com/open_api/v1.3/business/search/`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        search_type: 'user',
        count: 20
      })
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message);
    }

    return (data.data?.user_list || []).map(user => ({
      id: user.open_id,
      name: user.display_name,
      platform: 'tiktok',
      profile_url: `https://www.tiktok.com/@${user.unique_id}`,
      verified: user.is_verified,
      followers: user.follower_count || 0,
      source: 'tiktok_api'
    }));
  } catch (error) {
    console.error('TikTok API error:', error);
    return [];
  }
}

// Generate fallback results when APIs are not available
function generateFallbackResults(query, platform) {
  const cleanName = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const platforms = platform === 'all' 
    ? ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok']
    : [platform];

  return platforms.map(plt => {
    const platformUrls = {
      instagram: `https://instagram.com/${cleanName}`,
      facebook: `https://facebook.com/${cleanName}`,
      linkedin: `https://www.linkedin.com/company/${cleanName}`,
      twitter: `https://x.com/${cleanName}`,
      tiktok: `https://www.tiktok.com/@${cleanName}`
    };

    return {
      id: `fallback_${plt}_${Date.now()}`,
      name: query,
      platform: plt,
      profile_url: platformUrls[plt],
      verified: false,
      source: 'url_generation',
      note: 'Profile URL generated - click to verify existence'
    };
  });
}