// Demo API to test usage tracking system
// Shows real-time usage enforcement and limits

const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { user_email = 'demo@socialtrust.com', test_feature = 'AI_SENTIMENT', test_increment = 1 } = 
      event.queryStringParameters || {};
    
    console.log(`🧪 Demo Usage Tracking Test: ${user_email} -> ${test_feature}`);

    // Get organization
    const org = await getOrganizationByEmail(user_email);
    if (!org) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Could not get organization' })
      };
    }

    console.log(`📋 Organization: ${org.id} (Plan: ${org.current_plan_id})`);

    // Test usage tracking for the requested metric
    const metric = USAGE_METRICS[test_feature] || USAGE_METRICS.AI_SENTIMENT;
    
    const usageResult = await checkAndTrackUsage(
      org.id,
      metric,
      parseInt(test_increment),
      'demo_test'
    );

    return {
      statusCode: usageResult.allowed ? 200 : 429,
      headers,
      body: JSON.stringify({
        demo: true,
        user_email,
        organization_id: org.id,
        current_plan: org.current_plan_id,
        tested_metric: metric,
        increment: test_increment,
        result: {
          allowed: usageResult.allowed,
          current_usage: usageResult.current,
          limit: usageResult.limit,
          remaining: usageResult.remaining,
          percentage: usageResult.percentage,
          is_near_limit: usageResult.isNearLimit,
          plan_id: usageResult.planId
        },
        error: usageResult.error || null,
        upgrade_suggestion: usageResult.upgradeRequired ? 
          `Upgrade from ${usageResult.planId} to get more ${metric}` : null,
        
        // Available test parameters
        test_info: {
          available_features: Object.keys(USAGE_METRICS),
          usage_examples: {
            'Test AI Sentiment (1 usage)': '?user_email=demo@socialtrust.com&test_feature=AI_SENTIMENT&test_increment=1',
            'Test Review Invites (5 usage)': '?user_email=demo@socialtrust.com&test_feature=REVIEW_INVITES&test_increment=5',
            'Test API Requests (10 usage)': '?user_email=demo@socialtrust.com&test_feature=API_REQUESTS&test_increment=10'
          }
        }
      })
    };

  } catch (error) {
    console.error('Demo usage tracking error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        demo: true,
        error: 'Demo failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};