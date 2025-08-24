// Netlify Function: Check Subscription Status & Enforce Limits
// Real-time usage limit enforcement for SocialTrust plans

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { organizationId, feature, action = 'check' } = event.queryStringParameters || {};

    if (!organizationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Organization ID is required' })
      };
    }

    console.log('🔍 Checking subscription for org:', organizationId, 'feature:', feature);

    // Get organization with current plan
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('current_plan_id, subscription_status, current_period_start, current_period_end')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Organization not found' })
      };
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', org.current_plan_id)
      .single();

    if (planError || !plan) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Plan not found' })
      };
    }

    // Check if subscription is active
    const isActive = org.subscription_status === 'active' || org.current_plan_id === 'free';

    let response = {
      organization: org,
      plan: plan,
      isActive,
      features: plan.features || [],
      limits: plan.limits || {},
      usage: {}
    };

    // If checking specific feature usage
    if (feature) {
      const usageResult = await checkFeatureUsage(organizationId, feature, org, plan);
      response = { ...response, ...usageResult };

      // If action is 'increment', update usage
      if (action === 'increment' && usageResult.canUse) {
        await incrementUsage(organizationId, feature, org);
        
        // Refresh usage after increment
        const updatedUsage = await checkFeatureUsage(organizationId, feature, org, plan);
        response.usage = updatedUsage.usage;
      }
    } else {
      // Get all current usage
      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('period_start', org.current_period_start)
        .lte('period_end', org.current_period_end);

      if (usage) {
        const usageObj = {};
        usage.forEach(u => {
          usageObj[u.metric_name] = {
            current: u.current_usage,
            limit: plan.limits?.[u.metric_name] || null,
            percentage: plan.limits?.[u.metric_name] ? 
              Math.round((u.current_usage / plan.limits[u.metric_name]) * 100) : 0
          };
        });
        response.usage = usageObj;
      }
    }

    console.log('✅ Subscription check completed');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: response
      })
    };

  } catch (error) {
    console.error('❌ Subscription check error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to check subscription',
        message: error.message
      })
    };
  }
};

// Check specific feature usage
async function checkFeatureUsage(organizationId, featureName, org, plan) {
  const limits = plan.limits || {};
  const limit = limits[featureName];

  // No limit means unlimited (enterprise plan)
  if (!limit || limit === null) {
    return {
      canUse: true,
      usage: { current: 0, limit: null, unlimited: true }
    };
  }

  // Get current usage for this billing period
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('current_usage')
    .eq('organization_id', organizationId)
    .eq('metric_name', featureName)
    .gte('period_start', org.current_period_start)
    .lte('period_end', org.current_period_end)
    .single();

  const currentUsage = usage?.current_usage || 0;
  const canUse = currentUsage < limit;

  return {
    canUse,
    usage: {
      current: currentUsage,
      limit: limit,
      remaining: Math.max(0, limit - currentUsage),
      percentage: Math.round((currentUsage / limit) * 100)
    }
  };
}

// Increment usage counter
async function incrementUsage(organizationId, featureName, org) {
  const { error } = await supabase
    .rpc('increment_usage', {
      org_id: organizationId,
      metric_name: featureName,
      increment_value: 1
    });

  if (error) {
    console.error('❌ Error incrementing usage:', error);
    throw error;
  }

  console.log('📊 Usage incremented for:', featureName);
}