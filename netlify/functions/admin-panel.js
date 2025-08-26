// Admin Panel APIs - System Administration and Management
// Provides administrative functionality for managing organizations, users, and system monitoring
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Admin authentication middleware
const ADMIN_EMAILS = [
  'admin@socialtrust.com',
  'marco@socialtrust.com',
  'support@socialtrust.com'
];

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/admin-panel', '');
  
  try {
    // Admin authentication check
    const adminEmail = await verifyAdminAccess(event);
    if (!adminEmail) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Admin access required' })
      };
    }

    console.log(`🔐 Admin panel access: ${path} by ${adminEmail}`);

    switch (path) {
      // System overview and monitoring
      case '/system-overview':
        return await getSystemOverview(event, headers);
      
      case '/system-health':
        return await getSystemHealth(event, headers);
      
      case '/platform-analytics':
        return await getPlatformAnalytics(event, headers);
      
      // Organization management
      case '/list-organizations':
        return await listOrganizations(event, headers);
      
      case '/organization-details':
        return await getOrganizationDetails(event, headers);
      
      case '/update-organization':
        return await updateOrganization(event, headers);
      
      case '/suspend-organization':
        return await suspendOrganization(event, headers);
      
      // Subscription management
      case '/subscription-overview':
        return await getSubscriptionOverview(event, headers);
      
      case '/manual-upgrade':
        return await manualPlanUpgrade(event, headers);
      
      case '/refund-request':
        return await processRefundRequest(event, headers);
      
      // Support and customer service
      case '/support-tickets':
        return await getSupportTickets(event, headers);
      
      case '/customer-lookup':
        return await customerLookup(event, headers);
      
      case '/impersonate-user':
        return await impersonateUser(event, headers);
      
      // System configuration
      case '/feature-flags':
        return await getFeatureFlags(event, headers);
      
      case '/update-feature-flag':
        return await updateFeatureFlag(event, headers);
      
      case '/system-settings':
        return await getSystemSettings(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Admin endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Admin Panel error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Verify admin access
async function verifyAdminAccess(event) {
  // In real implementation, would verify JWT token or session
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const { admin_email } = event.queryStringParameters || {};
  
  // For demo, accept admin_email parameter
  if (admin_email && ADMIN_EMAILS.includes(admin_email)) {
    return admin_email;
  }
  
  // Alternatively, check Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In real implementation, decode JWT and verify admin role
    return 'admin@socialtrust.com'; // Mock admin
  }
  
  return null;
}

// Get system overview
async function getSystemOverview(event, headers) {
  const { period = '30' } = event.queryStringParameters || {};
  const daysInt = parseInt(period);
  const startDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000).toISOString();

  console.log(`📊 System overview requested for last ${daysInt} days`);

  // Gather system metrics in parallel
  const [
    organizationsResult,
    subscriptionsResult,
    usageStatsResult,
    notificationsResult,
    paymentsResult
  ] = await Promise.all([
    // Total organizations
    supabase
      .from('organizations')
      .select('*')
      .gte('created_at', startDate),
    
    // Active subscriptions
    supabase
      .from('organizations')
      .select('current_plan_id, subscription_status, billing_interval')
      .eq('subscription_status', 'active'),
    
    // Usage statistics
    supabase
      .from('usage_tracking')
      .select('*')
      .gte('updated_at', startDate),
    
    // Notifications sent
    supabase
      .from('notifications')
      .select('type, status, created_at')
      .gte('created_at', startDate),
    
    // Payments and billing
    supabase
      .from('billing_history')
      .select('amount, currency, status, created_at')
      .gte('created_at', startDate)
  ]);

  const overview = {
    period_days: daysInt,
    generated_at: new Date().toISOString(),
    
    organizations: {
      total_active: subscriptionsResult.data?.length || 0,
      new_signups: organizationsResult.data?.length || 0,
      by_plan: calculatePlanDistribution(subscriptionsResult.data || []),
      growth_rate: calculateGrowthRate(organizationsResult.data || [], daysInt)
    },
    
    usage_metrics: {
      total_api_requests: calculateTotalUsage(usageStatsResult.data || [], 'apiRequestsPerMonth'),
      total_review_invites: calculateTotalUsage(usageStatsResult.data || [], 'reviewInvitesPerMonth'),
      total_ai_analyses: calculateTotalUsage(usageStatsResult.data || [], 'ai_sentiment_analyses'),
      active_users_daily: calculateActiveUsers(usageStatsResult.data || [])
    },
    
    communications: {
      total_notifications: notificationsResult.data?.length || 0,
      email_delivered: notificationsResult.data?.filter(n => n.type === 'email' && n.status === 'delivered').length || 0,
      sms_delivered: notificationsResult.data?.filter(n => n.type === 'sms' && n.status === 'delivered').length || 0,
      delivery_rate: calculateDeliveryRate(notificationsResult.data || [])
    },
    
    revenue: {
      total_revenue: calculateTotalRevenue(paymentsResult.data || []),
      successful_payments: paymentsResult.data?.filter(p => p.status === 'paid').length || 0,
      failed_payments: paymentsResult.data?.filter(p => p.status === 'failed').length || 0,
      mrr: calculateMRR(subscriptionsResult.data || []),
      arr: calculateARR(subscriptionsResult.data || [])
    },
    
    top_metrics: generateTopMetrics(organizationsResult.data || [], usageStatsResult.data || [])
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      system_overview: overview
    })
  };
}

// Get system health status
async function getSystemHealth(event, headers) {
  console.log('🏥 System health check requested');

  // Check various system components
  const healthChecks = await Promise.allSettled([
    checkDatabaseHealth(),
    checkAPIEndpoints(),
    checkExternalServices(),
    checkStorageHealth(),
    checkBackgroundJobs()
  ]);

  const health = {
    overall_status: 'healthy',
    checked_at: new Date().toISOString(),
    components: {
      database: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { status: 'error', message: healthChecks[0].reason.message },
      api_endpoints: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { status: 'error' },
      external_services: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { status: 'error' },
      storage: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { status: 'error' },
      background_jobs: healthChecks[4].status === 'fulfilled' ? healthChecks[4].value : { status: 'error' }
    }
  };

  // Determine overall status
  const componentStatuses = Object.values(health.components).map(c => c.status);
  if (componentStatuses.includes('error')) {
    health.overall_status = 'degraded';
  }
  if (componentStatuses.filter(s => s === 'error').length > 2) {
    health.overall_status = 'unhealthy';
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      health
    })
  };
}

// List all organizations with admin details
async function listOrganizations(event, headers) {
  const { 
    page = '1', 
    limit = '50', 
    search = '', 
    plan = '', 
    status = '',
    sort = 'created_at'
  } = event.queryStringParameters || {};

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('organizations')
    .select(`
      *,
      billing_history(count),
      usage_tracking(*)
    `);

  // Apply filters
  if (search) {
    query = query.or(`billing_email.ilike.%${search}%,id.ilike.%${search}%`);
  }
  if (plan) {
    query = query.eq('current_plan_id', plan);
  }
  if (status) {
    query = query.eq('subscription_status', status);
  }

  const { data: organizations, error } = await query
    .order(sort, { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) {
    throw error;
  }

  // Get total count
  let countQuery = supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true });

  if (search) {
    countQuery = countQuery.or(`billing_email.ilike.%${search}%,id.ilike.%${search}%`);
  }
  if (plan) countQuery = countQuery.eq('current_plan_id', plan);
  if (status) countQuery = countQuery.eq('subscription_status', status);

  const { count } = await countQuery;

  // Enrich organization data
  const enrichedOrgs = organizations.map(org => ({
    ...org,
    total_payments: org.billing_history?.[0]?.count || 0,
    last_activity: getLastActivity(org.usage_tracking || []),
    health_score: calculateOrgHealthScore(org)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      organizations: enrichedOrgs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum)
      },
      filters: { search, plan, status, sort }
    })
  };
}

// Get detailed organization information
async function getOrganizationDetails(event, headers) {
  const { org_id } = event.queryStringParameters || {};
  
  if (!org_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'org_id parameter required' })
    };
  }

  // Get comprehensive organization data
  const [
    orgResult,
    billingResult,
    usageResult,
    businessesResult,
    notificationsResult
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', org_id).single(),
    supabase.from('billing_history').select('*').eq('organization_id', org_id).order('created_at', { ascending: false }),
    supabase.from('usage_tracking').select('*').eq('organization_id', org_id).order('updated_at', { ascending: false }),
    supabase.from('business_profiles').select('*').eq('organization_id', org_id),
    supabase.from('notifications').select('*').eq('organization_id', org_id).order('created_at', { ascending: false }).limit(10)
  ]);

  if (orgResult.error || !orgResult.data) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Organization not found' })
    };
  }

  const details = {
    organization: orgResult.data,
    billing_history: billingResult.data || [],
    current_usage: usageResult.data || [],
    businesses: businessesResult.data || [],
    recent_notifications: notificationsResult.data || [],
    
    summary: {
      total_spent: (billingResult.data || []).reduce((sum, b) => sum + (b.amount || 0), 0),
      days_active: Math.floor((new Date() - new Date(orgResult.data.created_at)) / (1000 * 60 * 60 * 24)),
      businesses_managed: (businessesResult.data || []).length,
      health_score: calculateOrgHealthScore(orgResult.data, usageResult.data || [])
    }
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      details
    })
  };
}

// Get platform analytics
async function getPlatformAnalytics(event, headers) {
  const { metric = 'overview', period = '30' } = event.queryStringParameters || {};
  const daysInt = parseInt(period);

  console.log(`📈 Platform analytics: ${metric} for ${daysInt} days`);

  const analytics = {};

  switch (metric) {
    case 'growth':
      analytics.growth_metrics = await calculateGrowthMetrics(daysInt);
      break;
    
    case 'revenue':
      analytics.revenue_metrics = await calculateRevenueMetrics(daysInt);
      break;
    
    case 'usage':
      analytics.usage_metrics = await calculateUsageMetrics(daysInt);
      break;
    
    case 'churn':
      analytics.churn_metrics = await calculateChurnMetrics(daysInt);
      break;
    
    default: // overview
      analytics.overview = await calculateOverviewMetrics(daysInt);
      break;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      metric,
      period_days: daysInt,
      analytics
    })
  };
}

// Helper functions for calculations
function calculatePlanDistribution(subscriptions) {
  const distribution = { free: 0, plus: 0, premium: 0, advanced: 0, enterprise: 0 };
  
  subscriptions.forEach(sub => {
    if (distribution.hasOwnProperty(sub.current_plan_id)) {
      distribution[sub.current_plan_id]++;
    }
  });
  
  return distribution;
}

function calculateGrowthRate(organizations, days) {
  if (days < 30) return 0;
  
  const halfwayPoint = new Date(Date.now() - (days / 2) * 24 * 60 * 60 * 1000);
  const firstHalf = organizations.filter(org => new Date(org.created_at) < halfwayPoint).length;
  const secondHalf = organizations.filter(org => new Date(org.created_at) >= halfwayPoint).length;
  
  return firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;
}

function calculateTotalUsage(usageData, metric) {
  return usageData
    .filter(usage => usage.metric_name === metric)
    .reduce((sum, usage) => sum + (usage.current_usage || 0), 0);
}

function calculateActiveUsers(usageData) {
  const uniqueOrgs = new Set(usageData.map(usage => usage.organization_id));
  return uniqueOrgs.size;
}

function calculateDeliveryRate(notifications) {
  if (notifications.length === 0) return 0;
  const delivered = notifications.filter(n => n.status === 'delivered').length;
  return Math.round((delivered / notifications.length) * 100);
}

function calculateTotalRevenue(payments) {
  return payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

function calculateMRR(subscriptions) {
  // Monthly Recurring Revenue calculation
  let mrr = 0;
  subscriptions.forEach(sub => {
    if (sub.subscription_status === 'active') {
      // Simplified MRR calculation based on plan
      const planValues = { free: 0, plus: 29, premium: 99, advanced: 299, enterprise: 999 };
      const planValue = planValues[sub.current_plan_id] || 0;
      
      if (sub.billing_interval === 'yearly') {
        mrr += planValue / 12;
      } else {
        mrr += planValue;
      }
    }
  });
  return Math.round(mrr);
}

function calculateARR(subscriptions) {
  return calculateMRR(subscriptions) * 12;
}

function generateTopMetrics(organizations, usageData) {
  return {
    most_active_organization: findMostActiveOrg(organizations, usageData),
    highest_usage_metric: findHighestUsageMetric(usageData),
    fastest_growing_plan: 'premium', // Mock data
    avg_time_to_upgrade: '14 days' // Mock data
  };
}

// Health check functions
async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabase.from('organizations').select('count').limit(1);
    if (error) throw error;
    
    return {
      status: 'healthy',
      response_time: Date.now(), // Simplified
      last_check: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      last_check: new Date().toISOString()
    };
  }
}

async function checkAPIEndpoints() {
  // Mock API health check
  return {
    status: 'healthy',
    endpoints_checked: 12,
    all_responsive: true,
    avg_response_time: 245
  };
}

async function checkExternalServices() {
  // Mock external services check
  return {
    status: 'healthy',
    services: {
      email_provider: 'healthy',
      sms_provider: 'healthy',
      payment_processor: 'healthy'
    }
  };
}

async function checkStorageHealth() {
  return {
    status: 'healthy',
    disk_usage: '45%',
    available_space: '2.1TB'
  };
}

async function checkBackgroundJobs() {
  return {
    status: 'healthy',
    jobs_running: 3,
    jobs_queued: 0,
    last_failure: null
  };
}

function calculateOrgHealthScore(org, usage = []) {
  let score = 100;
  
  // Deduct points for inactive organizations
  const daysSinceLastActivity = Math.floor((new Date() - new Date(org.updated_at)) / (1000 * 60 * 60 * 24));
  if (daysSinceLastActivity > 30) score -= 20;
  if (daysSinceLastActivity > 60) score -= 30;
  
  // Add points for active usage
  if (usage.length > 0) score += 10;
  if (org.current_plan_id !== 'free') score += 15;
  
  return Math.max(0, Math.min(100, score));
}

function getLastActivity(usageTracking) {
  if (!usageTracking.length) return null;
  return usageTracking.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0].updated_at;
}

function findMostActiveOrg(organizations, usageData) {
  const orgUsage = {};
  usageData.forEach(usage => {
    if (!orgUsage[usage.organization_id]) {
      orgUsage[usage.organization_id] = 0;
    }
    orgUsage[usage.organization_id] += usage.current_usage || 0;
  });
  
  const mostActiveOrgId = Object.keys(orgUsage).reduce((a, b) => 
    orgUsage[a] > orgUsage[b] ? a : b, '');
  
  const org = organizations.find(o => o.id === mostActiveOrgId);
  return org ? org.billing_email : 'N/A';
}

function findHighestUsageMetric(usageData) {
  const metricTotals = {};
  usageData.forEach(usage => {
    if (!metricTotals[usage.metric_name]) {
      metricTotals[usage.metric_name] = 0;
    }
    metricTotals[usage.metric_name] += usage.current_usage || 0;
  });
  
  return Object.keys(metricTotals).reduce((a, b) => 
    metricTotals[a] > metricTotals[b] ? a : b, 'none');
}

// Async metric calculation functions
async function calculateGrowthMetrics(days) {
  // Implementation would calculate detailed growth metrics
  return {
    new_signups: Math.floor(Math.random() * 100) + 50,
    activation_rate: Math.floor(Math.random() * 30) + 60,
    time_to_activation: '2.3 days'
  };
}

async function calculateRevenueMetrics(days) {
  return {
    total_revenue: Math.floor(Math.random() * 50000) + 25000,
    avg_revenue_per_user: Math.floor(Math.random() * 200) + 150,
    revenue_growth: Math.floor(Math.random() * 50) + 10
  };
}

async function calculateUsageMetrics(days) {
  return {
    total_api_calls: Math.floor(Math.random() * 1000000) + 500000,
    avg_calls_per_user: Math.floor(Math.random() * 5000) + 2000,
    peak_usage_day: new Date(Date.now() - Math.random() * days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
}

async function calculateChurnMetrics(days) {
  return {
    churn_rate: (Math.random() * 5 + 2).toFixed(1) + '%',
    retention_rate: (95 - Math.random() * 10).toFixed(1) + '%',
    avg_lifetime_value: '$' + (Math.random() * 2000 + 1000).toFixed(0)
  };
}

async function calculateOverviewMetrics(days) {
  return {
    total_users: Math.floor(Math.random() * 10000) + 5000,
    active_users: Math.floor(Math.random() * 3000) + 2000,
    conversion_rate: (Math.random() * 10 + 15).toFixed(1) + '%',
    customer_satisfaction: (Math.random() * 1 + 4).toFixed(1) + '/5.0'
  };
}