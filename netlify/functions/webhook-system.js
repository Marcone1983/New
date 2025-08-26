// Webhook System - Event-driven notifications for external systems
// Handles webhooks for subscription changes, payments, review events, and system notifications
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Webhook event types
const WEBHOOK_EVENTS = {
  // Subscription events
  'subscription.created': 'Subscription created',
  'subscription.updated': 'Subscription plan changed',
  'subscription.cancelled': 'Subscription cancelled',
  'subscription.reactivated': 'Subscription reactivated',
  
  // Payment events
  'payment.completed': 'Payment successfully processed',
  'payment.failed': 'Payment processing failed',
  'payment.refunded': 'Payment was refunded',
  
  // Review events
  'review.invite_sent': 'Review invite sent to customer',
  'review.response_received': 'Customer responded to review invite',
  'review.negative_detected': 'Negative review detected',
  
  // AI events
  'ai.sentiment_analysis_completed': 'AI sentiment analysis completed',
  'ai.auto_response_generated': 'AI auto-response generated',
  
  // System events
  'system.user_created': 'New user account created',
  'system.usage_limit_reached': 'Usage limit reached for organization',
  'system.feature_unlocked': 'New feature unlocked for user'
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Signature'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/webhook-system', '');
  
  try {
    switch (path) {
      // Webhook management
      case '/register-webhook':
        return await registerWebhook(event, headers);
      
      case '/list-webhooks':
        return await listWebhooks(event, headers);
      
      case '/update-webhook':
        return await updateWebhook(event, headers);
      
      case '/delete-webhook':
        return await deleteWebhook(event, headers);
      
      case '/test-webhook':
        return await testWebhook(event, headers);
      
      // Event triggering
      case '/trigger-event':
        return await triggerWebhookEvent(event, headers);
      
      case '/bulk-trigger':
        return await bulkTriggerEvents(event, headers);
      
      // Webhook logs and monitoring
      case '/webhook-logs':
        return await getWebhookLogs(event, headers);
      
      case '/webhook-stats':
        return await getWebhookStatistics(event, headers);
      
      // Incoming webhooks (for external services)
      case '/receive/payment':
        return await receivePaymentWebhook(event, headers);
      
      case '/receive/review':
        return await receiveReviewWebhook(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Webhook endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Webhook System error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Register new webhook endpoint
async function registerWebhook(event, headers) {
  const {
    user_email,
    webhook_url,
    events,
    description,
    secret_key,
    active = true
  } = JSON.parse(event.body || '{}');
  
  if (!user_email || !webhook_url || !events || !Array.isArray(events)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'user_email, webhook_url, and events array are required' 
      })
    };
  }

  // Validate webhook URL
  if (!isValidWebhookURL(webhook_url)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid webhook URL format' })
    };
  }

  // Validate events
  const invalidEvents = events.filter(event => !WEBHOOK_EVENTS[event]);
  if (invalidEvents.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Invalid events', 
        invalid_events: invalidEvents,
        supported_events: Object.keys(WEBHOOK_EVENTS)
      })
    };
  }

  console.log(`🔗 Registering webhook: ${webhook_url} for ${events.length} events by ${user_email}`);

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('billing_email', user_email)
    .single();

  if (!org) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Organization not found' })
    };
  }

  // Generate webhook ID and secret if not provided
  const webhookId = generateWebhookId();
  const webhookSecret = secret_key || generateWebhookSecret();

  // Create webhook record
  const { data: webhook, error } = await supabase
    .from('webhooks')
    .insert({
      id: webhookId,
      organization_id: org.id,
      webhook_url,
      events,
      description: description || `Webhook for ${webhook_url}`,
      secret_key: webhookSecret,
      active,
      created_at: new Date().toISOString(),
      last_triggered: null,
      total_triggers: 0,
      successful_triggers: 0,
      failed_triggers: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }

  // Test the webhook with a ping event
  await testWebhookConnection(webhook);

  console.log(`✅ Webhook registered: ${webhookId} for ${webhook_url}`);

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      success: true,
      webhook: {
        id: webhookId,
        webhook_url,
        events,
        secret_key: webhookSecret,
        active,
        created_at: webhook.created_at
      },
      supported_events: WEBHOOK_EVENTS
    })
  };
}

// List webhooks for organization
async function listWebhooks(event, headers) {
  const { user_email } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
    };
  }

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('billing_email', user_email)
    .single();

  if (!org) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Organization not found' })
    };
  }

  // Get webhooks
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  // Don't expose secret keys in the list
  const safeWebhooks = webhooks.map(webhook => ({
    ...webhook,
    secret_key: '***' + webhook.secret_key.slice(-4)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      webhooks: safeWebhooks,
      supported_events: WEBHOOK_EVENTS
    })
  };
}

// Trigger webhook event
async function triggerWebhookEvent(event, headers) {
  const {
    event_type,
    organization_id,
    event_data,
    test_mode = false
  } = JSON.parse(event.body || '{}');
  
  if (!event_type || !organization_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'event_type and organization_id are required' })
    };
  }

  if (!WEBHOOK_EVENTS[event_type]) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Invalid event type',
        supported_events: Object.keys(WEBHOOK_EVENTS)
      })
    };
  }

  console.log(`🚀 Triggering webhook event: ${event_type} for org ${organization_id}`);

  // Get webhooks listening for this event
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('organization_id', organization_id)
    .eq('active', true)
    .contains('events', [event_type]);

  if (error) {
    throw error;
  }

  if (!webhooks || webhooks.length === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'No active webhooks found for this event',
        event_type,
        webhooks_found: 0
      })
    };
  }

  // Trigger each webhook
  const results = [];
  for (const webhook of webhooks) {
    const result = await deliverWebhook(webhook, event_type, event_data, test_mode);
    results.push({
      webhook_id: webhook.id,
      webhook_url: webhook.webhook_url,
      ...result
    });

    // Update webhook statistics
    await updateWebhookStats(webhook.id, result.success);
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`✅ Webhook event triggered: ${successCount} successful, ${failureCount} failed`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      event_type,
      webhooks_triggered: webhooks.length,
      successful_deliveries: successCount,
      failed_deliveries: failureCount,
      results: results
    })
  };
}

// Deliver webhook to specific endpoint
async function deliverWebhook(webhook, eventType, eventData, testMode = false) {
  const payload = {
    id: generateEventId(),
    event: eventType,
    created: Math.floor(Date.now() / 1000),
    data: eventData || {},
    test_mode: testMode,
    webhook_id: webhook.id
  };

  // Generate signature
  const signature = generateWebhookSignature(JSON.stringify(payload), webhook.secret_key);

  try {
    const startTime = Date.now();
    
    // Make HTTP request to webhook URL
    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'User-Agent': 'SocialTrust-Webhooks/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000 // 10 second timeout
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    // Log webhook delivery
    await logWebhookDelivery(webhook.id, eventType, payload, {
      status_code: response.status,
      response_body: responseText,
      response_time: responseTime,
      success: response.ok
    });

    return {
      success: response.ok,
      status_code: response.status,
      response_time: responseTime,
      response_body: responseText.substring(0, 500) // Limit response body
    };

  } catch (error) {
    // Log failed delivery
    await logWebhookDelivery(webhook.id, eventType, payload, {
      status_code: 0,
      error: error.message,
      success: false
    });

    return {
      success: false,
      error: error.message,
      error_type: error.name
    };
  }
}

// Test webhook connection
async function testWebhookConnection(webhook) {
  const testPayload = {
    id: generateEventId(),
    event: 'ping',
    created: Math.floor(Date.now() / 1000),
    data: {
      message: 'This is a test ping from SocialTrust webhook system',
      webhook_id: webhook.id
    },
    test_mode: true
  };

  return await deliverWebhook(webhook, 'ping', testPayload.data, true);
}

// Get webhook logs
async function getWebhookLogs(event, headers) {
  const { 
    webhook_id, 
    user_email, 
    page = '1', 
    limit = '50',
    status = '' 
  } = event.queryStringParameters || {};
  
  if (!webhook_id && !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'webhook_id or user_email parameter required' })
    };
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('webhook_logs')
    .select('*');

  if (webhook_id) {
    query = query.eq('webhook_id', webhook_id);
  } else {
    // Get all webhooks for user's organization
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('billing_email', user_email)
      .single();

    if (!org) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Organization not found' })
      };
    }

    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('id')
      .eq('organization_id', org.id);

    const webhookIds = (webhooks || []).map(w => w.id);
    query = query.in('webhook_id', webhookIds);
  }

  if (status) {
    const isSuccess = status === 'success';
    query = query.eq('success', isSuccess);
  }

  const { data: logs, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) {
    throw error;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      logs: logs || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        has_more: (logs || []).length === limitNum
      }
    })
  };
}

// Get webhook statistics
async function getWebhookStatistics(event, headers) {
  const { user_email, days = '30' } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
    };
  }

  const daysInt = parseInt(days);
  const startDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000).toISOString();

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('billing_email', user_email)
    .single();

  if (!org) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Organization not found' })
    };
  }

  // Get webhooks and their stats
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('organization_id', org.id);

  if (!webhooks || webhooks.length === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        statistics: {
          total_webhooks: 0,
          active_webhooks: 0,
          total_deliveries: 0,
          successful_deliveries: 0,
          failed_deliveries: 0,
          success_rate: 0
        }
      })
    };
  }

  // Get webhook logs for the period
  const webhookIds = webhooks.map(w => w.id);
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .in('webhook_id', webhookIds)
    .gte('created_at', startDate);

  const statistics = {
    period_days: daysInt,
    total_webhooks: webhooks.length,
    active_webhooks: webhooks.filter(w => w.active).length,
    total_deliveries: logs?.length || 0,
    successful_deliveries: logs?.filter(l => l.success).length || 0,
    failed_deliveries: logs?.filter(l => !l.success).length || 0,
    success_rate: logs?.length > 0 ? 
      Math.round((logs.filter(l => l.success).length / logs.length) * 100) : 0,
    
    event_breakdown: calculateEventBreakdown(logs || []),
    webhook_performance: webhooks.map(webhook => ({
      id: webhook.id,
      url: webhook.webhook_url,
      total_triggers: webhook.total_triggers,
      successful_triggers: webhook.successful_triggers,
      failed_triggers: webhook.failed_triggers,
      success_rate: webhook.total_triggers > 0 ? 
        Math.round((webhook.successful_triggers / webhook.total_triggers) * 100) : 0
    }))
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      statistics
    })
  };
}

// Helper functions
function isValidWebhookURL(url) {
  try {
    const parsedURL = new URL(url);
    return parsedURL.protocol === 'https:' && parsedURL.hostname !== 'localhost';
  } catch {
    return false;
  }
}

function generateWebhookId() {
  return 'wh_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateWebhookSecret() {
  return 'whsec_' + crypto.randomBytes(32).toString('hex');
}

function generateEventId() {
  return 'evt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateWebhookSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

async function logWebhookDelivery(webhookId, eventType, payload, deliveryResult) {
  try {
    await supabase
      .from('webhook_logs')
      .insert({
        webhook_id: webhookId,
        event_type: eventType,
        payload: payload,
        status_code: deliveryResult.status_code,
        response_body: deliveryResult.response_body,
        response_time: deliveryResult.response_time,
        success: deliveryResult.success,
        error_message: deliveryResult.error,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging webhook delivery:', error);
  }
}

async function updateWebhookStats(webhookId, success) {
  try {
    const updates = {
      last_triggered: new Date().toISOString(),
      total_triggers: supabase.raw('total_triggers + 1')
    };

    if (success) {
      updates.successful_triggers = supabase.raw('successful_triggers + 1');
    } else {
      updates.failed_triggers = supabase.raw('failed_triggers + 1');
    }

    await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', webhookId);
  } catch (error) {
    console.error('Error updating webhook stats:', error);
  }
}

function calculateEventBreakdown(logs) {
  const breakdown = {};
  logs.forEach(log => {
    if (!breakdown[log.event_type]) {
      breakdown[log.event_type] = { total: 0, successful: 0 };
    }
    breakdown[log.event_type].total++;
    if (log.success) {
      breakdown[log.event_type].successful++;
    }
  });

  return Object.entries(breakdown).map(([event, stats]) => ({
    event_type: event,
    total_deliveries: stats.total,
    successful_deliveries: stats.successful,
    success_rate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0
  }));
}