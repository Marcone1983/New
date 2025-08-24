// Netlify Function: Statistics API
// Global statistics and analytics for the platform

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📊 Fetching platform statistics...');

    // Run all queries in parallel for better performance
    const [
      reviewsResult,
      businessesResult,
      platformsResult,
      avgRatingResult,
      recentActivityResult
    ] = await Promise.all([
      // Total reviews count
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true }),
      
      // Total businesses count
      supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true }),
      
      // Active platforms
      supabase
        .from('reviews')
        .select('platform')
        .then(result => {
          if (result.data) {
            const platforms = [...new Set(result.data.map(r => r.platform))];
            return { count: platforms.length, data: platforms };
          }
          return { count: 0, data: [] };
        }),
      
      // Average rating
      supabase
        .from('reviews')
        .select('rating'),
      
      // Recent activity (last 30 days)
      supabase
        .from('reviews')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .then(result => ({ count: result.data?.length || 0 }))
    ]);

    // Calculate average rating
    let avgRating = 0;
    if (avgRatingResult.data && avgRatingResult.data.length > 0) {
      const totalRating = avgRatingResult.data.reduce((sum, review) => sum + review.rating, 0);
      avgRating = (totalRating / avgRatingResult.data.length).toFixed(1);
    }

    // Get platform breakdown
    const platformBreakdown = {};
    if (avgRatingResult.data) {
      avgRatingResult.data.forEach(review => {
        if (!platformBreakdown[review.platform]) {
          platformBreakdown[review.platform] = { count: 0, total_rating: 0 };
        }
        platformBreakdown[review.platform].count++;
        platformBreakdown[review.platform].total_rating += review.rating;
      });

      // Calculate average for each platform
      Object.keys(platformBreakdown).forEach(platform => {
        const data = platformBreakdown[platform];
        data.avg_rating = (data.total_rating / data.count).toFixed(1);
      });
    }

    const stats = {
      totalReviews: reviewsResult.count || 0,
      totalBusinesses: businessesResult.count || 0,
      activePlatforms: platformsResult.count || 0,
      avgRating: parseFloat(avgRating),
      recentActivity: recentActivityResult.count || 0,
      platformBreakdown,
      lastUpdated: new Date().toISOString()
    };

    console.log('✅ Statistics fetched:', stats);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        stats,
        message: 'Statistics fetched successfully'
      })
    };

  } catch (error) {
    console.error('Statistics API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message
      })
    };
  }
};