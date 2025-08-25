// Usage Tracking and Limits Enforcement Utility
// Centralized usage tracking for all SocialTrust APIs

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Track usage and enforce limits before action
exports.checkAndTrackUsage = async (organizationId, metric, increment = 1, action = '') => {
  try {
    console.log(`🔍 Checking usage limit: ${metric} (+${increment}) for org ${organizationId}`);
    
    // Call subscription manager to track usage
    const response = await fetch(`${process.env.URL || 'https://socialtrust.netlify.app'}/.netlify/functions/subscription-manager/track-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        metric,
        increment,
        action
      })
    });
    
    const result = await response.json();
    
    if (response.status === 429) {
      // Usage limit exceeded
      return {
        allowed: false,
        error: 'Usage limit exceeded',
        current: result.current,
        limit: result.limit,
        planId: result.planId,
        upgradeRequired: true,
        message: `Plan ${result.planId} limit reached: ${result.current}/${result.limit} ${metric}`
      };
    }
    
    if (!result.success) {
      return {
        allowed: false,
        error: result.error || 'Usage tracking failed',
        message: `Could not track usage for ${metric}`
      };
    }
    
    return {
      allowed: true,
      current: result.current,
      limit: result.limit,
      percentage: result.percentage,
      remaining: result.remaining,
      isNearLimit: result.isNearLimit,
      planId: result.planId
    };
    
  } catch (error) {
    console.error('Usage tracking error:', error);
    
    // In case of tracking error, allow action but log warning
    console.warn(`⚠️ Usage tracking failed for ${metric}, allowing action`);
    return {
      allowed: true,
      error: 'Tracking unavailable',
      message: 'Usage tracking temporarily unavailable'
    };
  }
};

// Get organization ID by email (helper)
exports.getOrganizationByEmail = async (email) => {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, current_plan_id, billing_email')
      .eq('billing_email', email)
      .single();
      
    if (error || !org) {
      console.log(`📝 Creating new organization for ${email}`);
      
      // Create new organization with free plan
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          billing_email: email,
          current_plan_id: 'free',
          subscription_status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating organization:', createError);
        return null;
      }
      
      return newOrg;
    }
    
    return org;
    
  } catch (error) {
    console.error('Error getting organization:', error);
    return null;
  }
};

// Usage metrics constants
exports.USAGE_METRICS = {
  REVIEW_INVITES: 'reviewInvitesPerMonth',
  API_REQUESTS: 'apiRequestsPerMonth', 
  AI_SENTIMENT: 'ai_sentiment_analyses',
  AI_RESPONSES: 'ai_auto_responses',
  NFT_REWARDS: 'nft_rewards_distributed',
  TEAM_MEMBERS: 'teamMembers',
  MICRO_TIPS: 'micro_tips_sent',
  VR_CONTENT: 'vr_ar_content_generated',
  MARKET_INSIGHTS: 'market_insights_generated'
};

// Create enforcement wrapper for API endpoints
exports.withUsageTracking = (handler, metric, options = {}) => {
  return async (event, context) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    try {
      // Extract user/organization info from request
      const body = event.body ? JSON.parse(event.body) : {};
      const query = event.queryStringParameters || {};
      
      const userEmail = body.user_email || query.user_email || options.defaultEmail;
      
      if (!userEmail) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'User email required for usage tracking',
            required_field: 'user_email' 
          })
        };
      }
      
      // Get organization
      const org = await exports.getOrganizationByEmail(userEmail);
      if (!org) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Could not get user organization' })
        };
      }
      
      // Check and track usage
      const usageResult = await exports.checkAndTrackUsage(
        org.id, 
        metric, 
        options.increment || 1,
        options.action || event.path
      );
      
      if (!usageResult.allowed) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: usageResult.error,
            message: usageResult.message,
            usage: {
              current: usageResult.current,
              limit: usageResult.limit,
              planId: usageResult.planId,
              upgradeRequired: usageResult.upgradeRequired
            }
          })
        };
      }
      
      // Add org info to event for handler
      event.organization = org;
      event.usageInfo = usageResult;
      
      // Call original handler
      const result = await handler(event, context);
      
      // Add usage info to successful response
      if (result.statusCode === 200 && result.body) {
        try {
          const responseBody = JSON.parse(result.body);
          responseBody.usage_info = {
            current: usageResult.current,
            limit: usageResult.limit,
            remaining: usageResult.remaining,
            percentage: usageResult.percentage,
            isNearLimit: usageResult.isNearLimit
          };
          result.body = JSON.stringify(responseBody);
        } catch (e) {
          // Response is not JSON, skip adding usage info
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Usage tracking wrapper error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Usage tracking failed',
          message: error.message 
        })
      };
    }
  };
};