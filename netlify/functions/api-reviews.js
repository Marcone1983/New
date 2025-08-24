// Netlify Function: Reviews API
// Complete CRUD operations for reviews with business management

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const { httpMethod, body, queryStringParameters } = event;
  
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    switch (httpMethod) {
      case 'GET':
        return await getReviews(queryStringParameters, headers);
      case 'POST':
        return await createReview(JSON.parse(body), headers);
      case 'PUT':
        return await updateReview(JSON.parse(body), headers);
      case 'DELETE':
        return await deleteReview(queryStringParameters, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Reviews API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// GET /api/reviews - Fetch reviews with filters
async function getReviews(params, headers) {
  const {
    platform = 'all',
    search = '',
    business_id = null,
    limit = 50,
    offset = 0
  } = params || {};

  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        businesses (
          id,
          name,
          platform,
          profile_url,
          verified
        ),
        users (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by platform
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform);
    }

    // Filter by business ID
    if (business_id) {
      query = query.eq('business_id', business_id);
    }

    // Filter by business name (search)
    if (search) {
      const { data: businessIds } = await supabase
        .from('businesses')
        .select('id')
        .ilike('name', `%${search}%`);
      
      if (businessIds && businessIds.length > 0) {
        const ids = businessIds.map(b => b.id);
        query = query.in('business_id', ids);
      } else {
        // No businesses found with that search term
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            reviews: [],
            total: 0,
            filters: { platform, search, business_id }
          })
        };
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true });

    if (platform && platform !== 'all') {
      countQuery = countQuery.eq('platform', platform);
    }

    if (business_id) {
      countQuery = countQuery.eq('business_id', business_id);
    }

    const { count } = await countQuery;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reviews: data || [],
        total: count || 0,
        filters: { platform, search, business_id },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: (parseInt(offset) + parseInt(limit)) < (count || 0)
        }
      })
    };

  } catch (error) {
    console.error('Get reviews error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch reviews',
        message: error.message
      })
    };
  }
}

// POST /api/reviews - Create new review
async function createReview(reviewData, headers) {
  const {
    businessName,
    platform,
    profileUrl,
    rating,
    comment,
    userName,
    userEmail
  } = reviewData;

  // Validation
  if (!businessName || !platform || !rating || !userName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Missing required fields: businessName, platform, rating, userName'
      })
    };
  }

  if (rating < 1 || rating > 5) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Rating must be between 1 and 5'
      })
    };
  }

  try {
    // 1. Create or get user
    let userId;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('name', userName)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{ name: userName, email: userEmail }])
        .select('id')
        .single();

      if (userError) throw userError;
      userId = newUser.id;
    }

    // 2. Create or get business
    let businessId;
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .eq('platform', platform)
      .single();

    if (existingBusiness) {
      businessId = existingBusiness.id;
    } else {
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert([{
          name: businessName,
          platform: platform,
          profile_url: profileUrl,
          verified: false
        }])
        .select('id')
        .single();

      if (businessError) throw businessError;
      businessId = newBusiness.id;
    }

    // 3. Create review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert([{
        business_id: businessId,
        user_id: userId,
        rating: parseInt(rating),
        comment: comment,
        platform: platform
      }])
      .select(`
        *,
        businesses (
          id,
          name,
          platform,
          profile_url,
          verified
        ),
        users (
          id,
          name
        )
      `)
      .single();

    if (reviewError) throw reviewError;

    console.log('✅ Review created:', review.id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        review: review,
        message: 'Review created successfully'
      })
    };

  } catch (error) {
    console.error('Create review error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to create review',
        message: error.message
      })
    };
  }
}

// PUT /api/reviews - Update existing review
async function updateReview(updateData, headers) {
  const { id, rating, comment } = updateData;

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Review ID is required'
      })
    };
  }

  try {
    const updateFields = {};
    if (rating) updateFields.rating = parseInt(rating);
    if (comment !== undefined) updateFields.comment = comment;

    const { data, error } = await supabase
      .from('reviews')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        businesses (
          id,
          name,
          platform,
          profile_url,
          verified
        ),
        users (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        review: data,
        message: 'Review updated successfully'
      })
    };

  } catch (error) {
    console.error('Update review error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to update review',
        message: error.message
      })
    };
  }
}

// DELETE /api/reviews - Delete review
async function deleteReview(params, headers) {
  const { id } = params || {};

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Review ID is required'
      })
    };
  }

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Review deleted successfully'
      })
    };

  } catch (error) {
    console.error('Delete review error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete review',
        message: error.message
      })
    };
  }
}