// Real Subscription & Feature Management System
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Real plan configuration with ALL features
const PLANS = {
  free: {
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    features: {
      unlimited_reviews: true,
      basic_profile: true,
      respond_to_reviews: true,
      basic_widgets: true,
      auto_review_invites: false,
      custom_profile: false,
      hide_competitor_ads: false,
      advanced_widgets: false,
      zendesk_integration: false,
      basic_analytics: false,
      advanced_review_management: false,
      marketing_automation: false,
      customer_segmentation: false,
      detailed_reports: false,
      data_export: false,
      review_tagging: false,
      market_insights: false,
      trustscore_forecasting: false,
      sentiment_analysis: false,
      competitor_analysis: false,
      ai_automated_responses: false,
      predictive_analytics: false,
      full_api_access: false,
      custom_integrations: false,
      dedicated_support: false,
      soc2_compliance: false
    },
    limits: {
      reviewInvitesPerMonth: 50,
      apiRequestsPerMonth: 1000,
      teamMembers: 1,
      customDomains: 0,
      dataRetentionMonths: 12,
      supportLevel: 'community'
    }
  },
  
  plus: {
    name: 'Plus',
    price: { monthly: 99, yearly: 990 },
    features: {
      unlimited_reviews: true,
      basic_profile: true,
      respond_to_reviews: true,
      basic_widgets: true,
      auto_review_invites: true,
      custom_profile: true,
      hide_competitor_ads: true,
      advanced_widgets: true,
      zendesk_integration: true,
      basic_analytics: true,
      advanced_review_management: false,
      marketing_automation: false,
      customer_segmentation: false,
      detailed_reports: false,
      data_export: false,
      review_tagging: false,
      market_insights: false,
      trustscore_forecasting: false,
      sentiment_analysis: false,
      competitor_analysis: false,
      ai_automated_responses: false,
      predictive_analytics: false,
      full_api_access: false,
      custom_integrations: false,
      dedicated_support: false,
      soc2_compliance: false
    },
    limits: {
      reviewInvitesPerMonth: 200,
      apiRequestsPerMonth: 5000,
      teamMembers: 3,
      customDomains: 1,
      dataRetentionMonths: 24,
      supportLevel: 'email'
    }
  },
  
  premium: {
    name: 'Premium',
    price: { monthly: 249, yearly: 2490 },
    features: {
      unlimited_reviews: true,
      basic_profile: true,
      respond_to_reviews: true,
      basic_widgets: true,
      auto_review_invites: true,
      custom_profile: true,
      hide_competitor_ads: true,
      advanced_widgets: true,
      zendesk_integration: true,
      basic_analytics: true,
      advanced_review_management: true,
      marketing_automation: true,
      customer_segmentation: true,
      detailed_reports: true,
      data_export: true,
      review_tagging: false,
      market_insights: false,
      trustscore_forecasting: false,
      sentiment_analysis: false,
      competitor_analysis: false,
      ai_automated_responses: false,
      predictive_analytics: false,
      full_api_access: false,
      custom_integrations: false,
      dedicated_support: false,
      soc2_compliance: false
    },
    limits: {
      reviewInvitesPerMonth: 1000,
      apiRequestsPerMonth: 20000,
      teamMembers: 10,
      customDomains: 3,
      dataRetentionMonths: 36,
      supportLevel: 'priority'
    }
  },
  
  advanced: {
    name: 'Advanced',
    price: { monthly: 499, yearly: 4990 },
    features: {
      unlimited_reviews: true,
      basic_profile: true,
      respond_to_reviews: true,
      basic_widgets: true,
      auto_review_invites: true,
      custom_profile: true,
      hide_competitor_ads: true,
      advanced_widgets: true,
      zendesk_integration: true,
      basic_analytics: true,
      advanced_review_management: true,
      marketing_automation: true,
      customer_segmentation: true,
      detailed_reports: true,
      data_export: true,
      review_tagging: true,
      market_insights: true,
      trustscore_forecasting: true,
      sentiment_analysis: true,
      competitor_analysis: true,
      ai_automated_responses: false,
      predictive_analytics: false,
      full_api_access: true,
      custom_integrations: false,
      dedicated_support: true,
      soc2_compliance: false
    },
    limits: {
      reviewInvitesPerMonth: 5000,
      apiRequestsPerMonth: 50000,
      teamMembers: 25,
      customDomains: 10,
      dataRetentionMonths: 60,
      supportLevel: 'dedicated'
    }
  },
  
  enterprise: {
    name: 'Enterprise',
    price: { monthly: null, yearly: null },
    features: {
      unlimited_reviews: true,
      basic_profile: true,
      respond_to_reviews: true,
      basic_widgets: true,
      auto_review_invites: true,
      custom_profile: true,
      hide_competitor_ads: true,
      advanced_widgets: true,
      zendesk_integration: true,
      basic_analytics: true,
      advanced_review_management: true,
      marketing_automation: true,
      customer_segmentation: true,
      detailed_reports: true,
      data_export: true,
      review_tagging: true,
      market_insights: true,
      trustscore_forecasting: true,
      sentiment_analysis: true,
      competitor_analysis: true,
      ai_automated_responses: true,
      predictive_analytics: true,
      full_api_access: true,
      custom_integrations: true,
      dedicated_support: true,
      soc2_compliance: true
    },
    limits: {
      reviewInvitesPerMonth: Infinity,
      apiRequestsPerMonth: Infinity,
      teamMembers: Infinity,
      customDomains: Infinity,
      dataRetentionMonths: Infinity,
      supportLevel: 'white_glove'
    }
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/subscription-manager', '');
  
  try {
    switch (path) {
      case '/check-feature':
        return await checkFeature(event, headers);
      
      case '/get-plan':
        return await getPlan(event, headers);
      
      case '/upgrade-plan':
        return await upgradePlan(event, headers);
      
      case '/track-usage':
        return await trackUsage(event, headers);
      
      case '/get-usage':
        return await getUsage(event, headers);
      
      case '/unlock-feature':
        return await unlockFeature(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Subscription manager error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Check if a feature is available for an organization
async function checkFeature(event, headers) {
  const { organizationId, feature } = JSON.parse(event.body || '{}');
  
  if (!organizationId || !feature) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'organizationId and feature required' })
    };
  }
  
  // Get organization's current plan
  const { data: org, error } = await supabase
    .from('organizations')
    .select('current_plan_id')
    .eq('id', organizationId)
    .single();
    
  if (error || !org) {
    // Default to free plan if not found
    const freePlan = PLANS.free;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        hasFeature: freePlan.features[feature] || false,
        plan: 'free'
      })
    };
  }
  
  const plan = PLANS[org.current_plan_id] || PLANS.free;
  const hasFeature = plan.features[feature] || false;
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      hasFeature,
      plan: org.current_plan_id,
      featureName: feature
    })
  };
}

// Get current plan details
async function getPlan(event, headers) {
  const { organizationId } = event.queryStringParameters || {};
  
  if (!organizationId) {
    // Return all plans
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ plans: PLANS })
    };
  }
  
  // Get specific organization's plan
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();
    
  if (error || !org) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        plan: PLANS.free,
        organizationId: null 
      })
    };
  }
  
  const plan = PLANS[org.current_plan_id] || PLANS.free;
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      plan,
      organization: org,
      subscriptionStatus: org.subscription_status,
      currentPeriod: {
        start: org.current_period_start,
        end: org.current_period_end
      }
    })
  };
}

// Upgrade plan (after crypto payment confirmed)
async function upgradePlan(event, headers) {
  const { organizationId, newPlanId, paymentId } = JSON.parse(event.body || '{}');
  
  if (!organizationId || !newPlanId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'organizationId and newPlanId required' })
    };
  }
  
  const newPlan = PLANS[newPlanId];
  if (!newPlan) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid plan ID' })
    };
  }
  
  // Update organization's plan
  const { data, error } = await supabase
    .from('organizations')
    .update({
      current_plan_id: newPlanId,
      subscription_status: 'active',
      subscription_start_date: new Date().toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', organizationId)
    .select()
    .single();
    
  if (error) {
    throw error;
  }
  
  // Reset usage for new billing period
  await resetUsageTracking(organizationId);
  
  // Log the upgrade
  await supabase
    .from('plan_changes')
    .insert({
      organization_id: organizationId,
      to_plan_id: newPlanId,
      change_type: 'upgrade',
      effective_date: new Date().toISOString(),
      metadata: { paymentId }
    });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      newPlan,
      organization: data
    })
  };
}

// Track usage (API calls, invites, etc)
async function trackUsage(event, headers) {
  const { organizationId, metric, increment = 1 } = JSON.parse(event.body || '{}');
  
  if (!organizationId || !metric) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'organizationId and metric required' })
    };
  }
  
  // Get organization's plan and limits
  const { data: org } = await supabase
    .from('organizations')
    .select('current_plan_id, current_period_start, current_period_end')
    .eq('id', organizationId)
    .single();
    
  const plan = PLANS[org?.current_plan_id || 'free'];
  const limit = plan.limits[metric];
  
  // Get current usage
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('current_usage')
    .eq('organization_id', organizationId)
    .eq('metric_name', metric)
    .gte('period_start', org?.current_period_start || new Date().toISOString())
    .single();
    
  const currentUsage = (usage?.current_usage || 0) + increment;
  
  // Check if limit exceeded
  if (limit && currentUsage > limit) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: 'Usage limit exceeded',
        metric,
        current: currentUsage,
        limit,
        plan: org?.current_plan_id || 'free'
      })
    };
  }
  
  // Update usage
  await supabase
    .from('usage_tracking')
    .upsert({
      organization_id: organizationId,
      metric_name: metric,
      current_usage: currentUsage,
      limit_value: limit,
      period_start: org?.current_period_start || new Date().toISOString(),
      period_end: org?.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'organization_id,metric_name,period_start'
    });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      metric,
      usage: currentUsage,
      limit,
      remaining: limit ? limit - currentUsage : null
    })
  };
}

// Get current usage stats
async function getUsage(event, headers) {
  const { organizationId } = event.queryStringParameters || {};
  
  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'organizationId required' })
    };
  }
  
  // Get organization and plan
  const { data: org } = await supabase
    .from('organizations')
    .select('current_plan_id, current_period_start, current_period_end')
    .eq('id', organizationId)
    .single();
    
  const plan = PLANS[org?.current_plan_id || 'free'];
  
  // Get all usage metrics
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('period_start', org?.current_period_start || new Date().toISOString());
    
  // Format usage data
  const usageData = {};
  Object.keys(plan.limits).forEach(metric => {
    const metricUsage = usage?.find(u => u.metric_name === metric);
    usageData[metric] = {
      current: metricUsage?.current_usage || 0,
      limit: plan.limits[metric],
      percentage: plan.limits[metric] ? 
        Math.round(((metricUsage?.current_usage || 0) / plan.limits[metric]) * 100) : 0
    };
  });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      plan: org?.current_plan_id || 'free',
      period: {
        start: org?.current_period_start,
        end: org?.current_period_end
      },
      usage: usageData
    })
  };
}

// Unlock specific feature (for add-ons)
async function unlockFeature(event, headers) {
  const { organizationId, featureId, duration = 30 } = JSON.parse(event.body || '{}');
  
  if (!organizationId || !featureId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'organizationId and featureId required' })
    };
  }
  
  // Add feature unlock to database
  await supabase
    .from('feature_unlocks')
    .insert({
      organization_id: organizationId,
      feature_id: featureId,
      unlocked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      feature: featureId,
      unlockedUntil: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
    })
  };
}

// Reset usage tracking for new billing period
async function resetUsageTracking(organizationId) {
  const metrics = [
    'reviewInvitesPerMonth',
    'apiRequestsPerMonth',
    'teamMembers'
  ];
  
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  for (const metric of metrics) {
    await supabase
      .from('usage_tracking')
      .upsert({
        organization_id: organizationId,
        metric_name: metric,
        current_usage: 0,
        period_start: now.toISOString(),
        period_end: nextMonth.toISOString(),
        updated_at: now.toISOString()
      }, {
        onConflict: 'organization_id,metric_name,period_start'
      });
  }
}