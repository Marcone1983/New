// Complete SocialTrust System Demo
// Demonstrates enterprise subscription system with crypto payments, AI features, and monetization modules

const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

  const { demo_action = 'overview', user_email = 'demo@socialtrust.com' } = 
    event.queryStringParameters || {};

  try {
    console.log(`🎯 Complete System Demo: ${demo_action} for ${user_email}`);

    // Get organization details
    const org = await getOrganizationByEmail(user_email);
    if (!org) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          demo: true,
          error: 'Organization not found',
          suggestion: 'Try with demo@socialtrust.com'
        })
      };
    }

    switch (demo_action) {
      case 'overview':
        return await generateSystemOverview(org, headers);
      
      case 'test_ai_limits':
        return await testAILimits(org, headers);
      
      case 'test_nft_rewards':
        return await testNFTRewards(org, headers);
      
      case 'simulate_upgrade_flow':
        return await simulateUpgradeFlow(org, headers);

      default:
        return await generateSystemOverview(org, headers);
    }

  } catch (error) {
    console.error('Complete system demo error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        demo: true,
        error: 'Demo failed',
        message: error.message
      })
    };
  }
};

// Generate complete system overview
async function generateSystemOverview(org, headers) {
  // Get current usage across all metrics
  const usagePromises = Object.values(USAGE_METRICS).map(async (metric) => {
    try {
      const result = await checkAndTrackUsage(org.id, metric, 0, 'demo_check');
      return {
        metric,
        current: result.current || 0,
        limit: result.limit,
        remaining: result.remaining,
        percentage: result.percentage || 0
      };
    } catch (error) {
      return {
        metric,
        current: 0,
        limit: 'unlimited',
        remaining: 'unlimited',
        percentage: 0,
        error: error.message
      };
    }
  });

  const usageStats = await Promise.all(usagePromises);

  // Get subscription info
  const { data: billingHistory } = await supabase
    .from('billing_history')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      demo: true,
      system_overview: {
        organization: {
          id: org.id,
          email: org.billing_email,
          current_plan: org.current_plan_id,
          subscription_status: org.subscription_status,
          period_start: org.current_period_start,
          period_end: org.current_period_end
        },
        
        usage_statistics: usageStats,
        
        recent_billing: billingHistory || [],
        
        available_features: {
          '🧠 AI Features': {
            sentiment_analysis: `/.netlify/functions/ai-features/sentiment-analysis`,
            auto_response: `/.netlify/functions/ai-features/auto-response`
          },
          '🪙 Monetization': {
            nft_rewards: `/.netlify/functions/monetization-modules/nft-rewards`,
            vr_ar_content: `/.netlify/functions/monetization-modules/vr-ar`,
            gamification: `/.netlify/functions/monetization-modules/gamification`
          },
          '💳 Crypto Payments': {
            create_payment: `/.netlify/functions/crypto-create-payment`,
            verify_payment: `/.netlify/functions/crypto-verify-payment`
          }
        },
        
        demo_tests: {
          'Test AI Limits': '?demo_action=test_ai_limits',
          'Test NFT Rewards': '?demo_action=test_nft_rewards',  
          'Simulate Upgrade Flow': '?demo_action=simulate_upgrade_flow'
        }
      }
    })
  };
}

// Test AI features with limits
async function testAILimits(org, headers) {
  const tests = [];

  // Test AI Sentiment Analysis
  try {
    const sentimentResult = await checkAndTrackUsage(
      org.id, 
      USAGE_METRICS.AI_SENTIMENT, 
      1, 
      'demo_ai_test'
    );
    
    tests.push({
      test: 'AI Sentiment Analysis',
      result: sentimentResult.allowed ? 'PASS' : 'LIMIT_REACHED',
      usage: `${sentimentResult.current}/${sentimentResult.limit}`,
      remaining: sentimentResult.remaining
    });
  } catch (error) {
    tests.push({
      test: 'AI Sentiment Analysis',
      result: 'ERROR',
      error: error.message
    });
  }

  // Test AI Auto Response
  try {
    const responseResult = await checkAndTrackUsage(
      org.id, 
      USAGE_METRICS.AI_RESPONSES, 
      1, 
      'demo_ai_test'
    );
    
    tests.push({
      test: 'AI Auto Response',
      result: responseResult.allowed ? 'PASS' : 'LIMIT_REACHED',
      usage: `${responseResult.current}/${responseResult.limit}`,
      remaining: responseResult.remaining
    });
  } catch (error) {
    tests.push({
      test: 'AI Auto Response',
      result: 'ERROR',
      error: error.message
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      demo: true,
      test_type: 'AI Limits Testing',
      organization_plan: org.current_plan_id,
      test_results: tests,
      summary: {
        total_tests: tests.length,
        passed: tests.filter(t => t.result === 'PASS').length,
        limits_reached: tests.filter(t => t.result === 'LIMIT_REACHED').length,
        errors: tests.filter(t => t.result === 'ERROR').length
      }
    })
  };
}

// Test NFT rewards system
async function testNFTRewards(org, headers) {
  try {
    const nftResult = await checkAndTrackUsage(
      org.id, 
      USAGE_METRICS.NFT_REWARDS, 
      1, 
      'demo_nft_test'
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        demo: true,
        test_type: 'NFT Rewards Testing',
        organization_plan: org.current_plan_id,
        nft_system_test: {
          can_mint: nftResult.allowed,
          usage: `${nftResult.current}/${nftResult.limit}`,
          remaining: nftResult.remaining,
          percentage: nftResult.percentage,
          is_near_limit: nftResult.isNearLimit
        },
        simulated_nft: {
          tier: 'bronze',
          name: 'Demo Reviewer NFT',
          tokens_awarded: 10,
          rarity: 'common',
          description: 'Simulated NFT for demo purposes'
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        demo: true,
        test_type: 'NFT Rewards Testing',
        error: error.message
      })
    };
  }
}

// Simulate upgrade flow
async function simulateUpgradeFlow(org, headers) {
  const currentPlan = org.current_plan_id;
  const planHierarchy = ['free', 'plus', 'premium', 'advanced', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  const nextPlan = planHierarchy[currentIndex + 1] || 'enterprise';

  const upgradeInfo = {
    current_plan: currentPlan,
    suggested_plan: nextPlan,
    upgrade_benefits: getUpgradeBenefits(currentPlan, nextPlan),
    crypto_payment_options: [
      { currency: 'ETH', network: 'Ethereum', wallet: process.env.CRYPTO_PAYMENT_WALLET },
      { currency: 'USDC', network: 'Polygon', wallet: process.env.CRYPTO_PAYMENT_WALLET },
      { currency: 'BNB', network: 'BSC', wallet: process.env.CRYPTO_PAYMENT_WALLET }
    ]
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      demo: true,
      simulation_type: 'Upgrade Flow',
      upgrade_info: upgradeInfo,
      next_steps: [
        '1. User selects upgrade plan',
        '2. System generates crypto payment session',
        '3. User pays via crypto wallet',
        '4. System verifies blockchain transaction',
        '5. Plan upgraded automatically',
        '6. All new features unlocked immediately'
      ]
    })
  };
}

function getUpgradeBenefits(currentPlan, nextPlan) {
  const benefits = {
    'free_to_plus': ['AI Automated Responses', 'Advanced Analytics', 'NFT Rewards', 'Gamification'],
    'plus_to_premium': ['Custom Branding', 'API Access', 'Priority Support', 'VR/AR Content', 'Micro-tipping'],
    'premium_to_advanced': ['White Label Solution', 'Insights Marketplace', 'Full API Access'],
    'advanced_to_enterprise': ['Unlimited Everything', 'Dedicated Support', 'Custom Integrations']
  };

  return benefits[`${currentPlan}_to_${nextPlan}`] || ['Enhanced Features', 'Higher Limits'];
}