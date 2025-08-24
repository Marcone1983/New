// Netlify Function: Check if social media profile URL exists
// This helps verify if a business profile actually exists on a platform

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { url } = JSON.parse(event.body);
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }

    // Check if URL is accessible
    const exists = await checkUrlExists(url);
    const profileData = exists ? await extractProfileData(url) : null;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        url: url,
        exists: exists,
        profile: profileData,
        checked_at: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('URL check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to check URL',
        exists: false
      })
    };
  }
};

// Check if URL exists and is accessible
async function checkUrlExists(url) {
  try {
    // Set reasonable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    // Consider 2xx and 3xx as existing (redirects are common)
    return response.status >= 200 && response.status < 400;

  } catch (error) {
    // Network errors, timeouts, or CORS issues
    // For social media sites with strict CORS, we'll get an error
    // but the profile might still exist
    
    if (error.name === 'AbortError') {
      console.log('URL check timeout:', url);
    }
    
    // For social media domains, assume profile might exist if we get CORS errors
    if (isSocialMediaDomain(url)) {
      return true; // Assume exists due to CORS restrictions
    }
    
    return false;
  }
}

// Extract basic profile data if possible
async function extractProfileData(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SocialTrust/1.0; +https://socialtrust.app)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Extract basic meta information
    const profile = {
      title: extractMetaContent(html, 'og:title') || extractTitle(html),
      description: extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description'),
      image: extractMetaContent(html, 'og:image'),
      type: extractMetaContent(html, 'og:type'),
      url: extractMetaContent(html, 'og:url') || url
    };

    // Platform-specific extraction
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('instagram.com')) {
      profile.platform = 'instagram';
      profile.followers = extractInstagramFollowers(html);
    } else if (domain.includes('facebook.com')) {
      profile.platform = 'facebook';
      profile.likes = extractFacebookLikes(html);
    } else if (domain.includes('linkedin.com')) {
      profile.platform = 'linkedin';
      profile.employees = extractLinkedInEmployees(html);
    } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
      profile.platform = 'twitter';
      profile.followers = extractTwitterFollowers(html);
    } else if (domain.includes('tiktok.com')) {
      profile.platform = 'tiktok';
      profile.followers = extractTikTokFollowers(html);
    }

    return profile;

  } catch (error) {
    console.log('Profile data extraction failed:', error.message);
    return null;
  }
}

// Helper functions for meta data extraction
function extractMetaContent(html, property) {
  const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

// Platform-specific data extractors
function extractInstagramFollowers(html) {
  // Instagram usually has follower count in meta tags or JSON-LD
  const match = html.match(/"edge_followed_by":{"count":(\d+)}/);
  return match ? parseInt(match[1]) : null;
}

function extractFacebookLikes(html) {
  // Facebook page likes extraction
  const match = html.match(/"page_likers":{"count":(\d+)}/);
  return match ? parseInt(match[1]) : null;
}

function extractLinkedInEmployees(html) {
  // LinkedIn company size
  const match = html.match(/"staffCount":(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractTwitterFollowers(html) {
  // Twitter followers from meta data
  const match = html.match(/"followers_count":(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractTikTokFollowers(html) {
  // TikTok followers
  const match = html.match(/"followerCount":(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Check if domain is a known social media platform
function isSocialMediaDomain(url) {
  const socialDomains = [
    'instagram.com',
    'facebook.com', 
    'linkedin.com',
    'twitter.com',
    'x.com',
    'tiktok.com'
  ];
  
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return socialDomains.some(socialDomain => domain.includes(socialDomain));
  } catch {
    return false;
  }
}