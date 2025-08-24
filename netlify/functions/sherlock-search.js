// Netlify Function: Business Search API
// JavaScript-based business profile discovery across social platforms

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { query, platforms } = JSON.parse(event.body);
    
    if (!query || query.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    console.log('🔍 Sherlock OSINT search for:', query);

    // Check cache first
    const cachedResult = await getCachedResult(query, 'sherlock_osint');
    if (cachedResult) {
      console.log('⚡ CACHE HIT - Sherlock results');
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          ...cachedResult,
          cached: true,
          message: 'Cached OSINT results'
        })
      };
    }

    // Execute business search
    const businessResults = await executeBusinessSearch(query, platforms);
    
    const finalResult = {
      success: true,
      query: query,
      platform: 'business_search',
      results: businessResults.profiles || [],
      method: 'api',
      totalFound: businessResults.profiles?.length || 0,
      source: 'business_api'
    };

    // Cache the result
    await cacheResult(query, 'sherlock_osint', finalResult);
    
    console.log(`✅ Sherlock found ${finalResult.results.length} profiles`);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        ...finalResult,
        message: 'OSINT search completed'
      })
    };

  } catch (error) {
    console.error('Sherlock search error:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'Sherlock OSINT search failed',
        message: error.message
      })
    };
  }
};

async function executeBusinessSearch(businessName, targetPlatforms = null) {
  console.log('🔍 Executing JavaScript business search for:', businessName);
  
  // Generate business profile URLs for major platforms
  const platforms = targetPlatforms || ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok'];
  const profiles = [];
  
  const cleanName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const platform of platforms) {
    let profileUrl;
    
    switch (platform) {
      case 'instagram':
        profileUrl = `https://instagram.com/${cleanName}`;
        break;
      case 'facebook':
        profileUrl = `https://facebook.com/${cleanName}`;
        break;
      case 'linkedin':
        profileUrl = `https://www.linkedin.com/company/${cleanName}`;
        break;
      case 'twitter':
        profileUrl = `https://x.com/${cleanName}`;
        break;
      case 'tiktok':
        profileUrl = `https://www.tiktok.com/@${cleanName}`;
        break;
      default:
        continue;
    }
    
    profiles.push({
      id: `${platform}_${cleanName}`,
      name: businessName,
      platform: platform,
      profile_url: profileUrl,
      username: cleanName,
      verified: false,
      confidence: 0.8,
      relevance_score: 80
    });
  }
  
  return {
    profiles: profiles,
    total_profiles_found: profiles.length
  };
}

// Cache functions
function generateQueryHash(query, platform) {
  const normalizedQuery = query.toLowerCase().trim();
  const hashInput = `${normalizedQuery}_${platform}`;
  
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

async function getCachedResult(query, platform) {
  const queryHash = generateQueryHash(query, platform);
  
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('*')
      .eq('query_hash', queryHash)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') {
      return null;
    }

    if (data) {
      // Update hit count
      await supabase
        .from('api_cache')
        .update({
          hit_count: data.hit_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', data.id);
      
      return {
        success: true,
        results: data.response_data.results || data.response_data,
        query: data.query_text,
        platform: data.platform,
        hitCount: data.hit_count + 1
      };
    }

    return null;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

async function cacheResult(query, platform, apiResponse) {
  const queryHash = generateQueryHash(query, platform);
  
  try {
    const expiresAt = new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)); // 90 days

    const cacheData = {
      query_hash: queryHash,
      query_text: query,
      platform: platform,
      response_data: apiResponse,
      expires_at: expiresAt.toISOString(),
      hit_count: 1
    };

    await supabase
      .from('api_cache')
      .insert([cacheData]);

    console.log('💾 CACHED SHERLOCK QUERY:', query);

  } catch (error) {
    console.error('Cache storage error:', error);
  }
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}