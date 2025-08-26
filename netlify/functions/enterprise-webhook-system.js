// PRODUCTION ENTERPRISE WEBHOOK SYSTEM
// Real-time notifications with queue management, retry logic, multi-channel delivery
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Webhook event configurations
const WEBHOOK_EVENTS = {
  'review.negative': { priority: 'critical', channels: ['webhook', 'email', 'sms'] },
  'review.positive': { priority: 'normal', channels: ['webhook'] },
  'sentiment.crisis': { priority: 'critical', channels: ['webhook', 'slack', 'email', 'sms'] },
  'competitor.detected': { priority: 'high', channels: ['webhook', 'slack'] },
  'blockchain.large_transaction': { priority: 'high', channels: ['webhook', 'discord'] },
  'system.usage_limit': { priority: 'high', channels: ['webhook', 'email'] },
  'system.security_alert': { priority: 'critical', channels: ['webhook', 'slack', 'email'] }
};

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

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    switch (action) {
      case 'send_webhook':
        return await sendWebhookNotification(body, headers);
        
      case 'register_endpoint':
        return await registerWebhookEndpoint(body, headers);
        
      case 'test_endpoint':
        return await testWebhookEndpoint(body, headers);
        
      case 'get_delivery_logs':
        return await getDeliveryLogs(body, headers);
        
      case 'get_webhook_stats':
        return await getWebhookStatistics(body, headers);
        
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action specified' })
        };
    }

  } catch (error) {
    console.error('Webhook system error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// CORE WEBHOOK DELIVERY SYSTEM
async function sendWebhookNotification(body, headers) {
  try {
    const { 
      event_type, 
      payload, 
      organization_id,
      channels = null,
      immediate = false 
    } = body;

    if (!event_type || !payload || !organization_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'event_type, payload, and organization_id are required' })
      };
    }

    // Get event configuration
    const eventConfig = WEBHOOK_EVENTS[event_type] || {
      priority: 'normal',
      channels: ['webhook']
    };

    // Get active webhook endpoints
    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('active', true);

    if (!endpoints || endpoints.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'No webhook endpoints configured',
          deliveries: []
        })
      };
    }

    const deliveryResults = [];
    const deliveryChannels = channels || eventConfig.channels;

    // Process each endpoint and channel
    for (const endpoint of endpoints) {
      for (const channel of deliveryChannels) {
        if (endpoint.channels?.includes(channel) || channel === 'webhook') {
          
          const webhookData = {
            webhook_id: crypto.randomUUID(),
            organization_id,
            endpoint_id: endpoint.id,
            event_type,
            payload,
            channel,
            endpoint_url: endpoint.url,
            secret: endpoint.secret,
            created_at: new Date().toISOString()
          };

          try {
            const result = await deliverWebhook(webhookData);
            deliveryResults.push(result);
            
            // Log successful delivery
            await logWebhookDelivery({
              ...webhookData,
              status: 'delivered',
              response_code: result.statusCode,
              response_time_ms: result.responseTime,
              delivered_at: new Date().toISOString()
            });

          } catch (error) {
            console.error(`Webhook delivery failed:`, error);
            
            deliveryResults.push({
              webhook_id: webhookData.webhook_id,
              channel: webhookData.channel,
              status: 'failed',
              error: error.message
            });

            // Log failed delivery
            await logWebhookDelivery({
              ...webhookData,
              status: 'failed',
              error_message: error.message,
              failed_at: new Date().toISOString()
            });

            // Schedule retry for critical events
            if (eventConfig.priority === 'critical') {
              await scheduleWebhookRetry(webhookData, error.message);
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        event_type,
        deliveries_attempted: deliveryResults.length,
        deliveries: deliveryResults
      })
    };

  } catch (error) {
    console.error('Send webhook notification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send webhook notification' })
    };
  }
}

// MULTI-CHANNEL WEBHOOK DELIVERY
async function deliverWebhook(webhookData) {
  const startTime = Date.now();
  
  switch (webhookData.channel) {
    case 'webhook':
      return await deliverHTTPWebhook(webhookData, startTime);
    case 'email':
      return await deliverEmailNotification(webhookData, startTime);
    case 'sms':
      return await deliverSMSNotification(webhookData, startTime);
    case 'slack':
      return await deliverSlackNotification(webhookData, startTime);
    case 'discord':
      return await deliverDiscordNotification(webhookData, startTime);
    default:
      throw new Error(`Unsupported delivery channel: ${webhookData.channel}`);
  }
}

// HTTP WEBHOOK DELIVERY WITH SIGNATURE
async function deliverHTTPWebhook(webhookData, startTime) {
  const timestamp = Date.now();
  const signature = generateWebhookSignature(webhookData.payload, webhookData.secret, timestamp);
  
  const webhookHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'SocialTrust-Webhooks/1.0',
    'X-SocialTrust-Event': webhookData.event_type,
    'X-SocialTrust-Webhook-Id': webhookData.webhook_id,
    'X-SocialTrust-Timestamp': timestamp.toString(),
    'X-SocialTrust-Signature': signature
  };

  const response = await axios.post(webhookData.endpoint_url, webhookData.payload, {
    headers: webhookHeaders,
    timeout: 30000,
    validateStatus: function (status) {
      return status >= 200 && status < 300;
    }
  });

  return {
    webhook_id: webhookData.webhook_id,
    channel: 'webhook',
    status: 'delivered',
    statusCode: response.status,
    responseTime: Date.now() - startTime,
    responseData: response.data
  };
}

// EMAIL NOTIFICATION DELIVERY
async function deliverEmailNotification(webhookData, startTime) {
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransporter({
    service: 'SendGrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  });

  const emailContent = formatEmailContent(webhookData.event_type, webhookData.payload);
  
  const mailOptions = {
    from: 'alerts@socialtrust.ai',
    to: webhookData.payload.notification_email || webhookData.payload.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  };

  const result = await transporter.sendMail(mailOptions);
  
  return {
    webhook_id: webhookData.webhook_id,
    channel: 'email',
    status: 'delivered',
    statusCode: 200,
    responseTime: Date.now() - startTime,
    messageId: result.messageId
  };
}

// SMS NOTIFICATION DELIVERY
async function deliverSMSNotification(webhookData, startTime) {
  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  const smsContent = formatSMSContent(webhookData.event_type, webhookData.payload);
  
  const message = await twilio.messages.create({
    body: smsContent,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: webhookData.payload.notification_phone || webhookData.payload.phone
  });

  return {
    webhook_id: webhookData.webhook_id,
    channel: 'sms',
    status: 'delivered',
    statusCode: 200,
    responseTime: Date.now() - startTime,
    messageId: message.sid
  };
}

// SLACK NOTIFICATION DELIVERY
async function deliverSlackNotification(webhookData, startTime) {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || webhookData.payload.slack_webhook;
  
  if (!slackWebhookUrl) {
    throw new Error('Slack webhook URL not configured');
  }

  const slackMessage = formatSlackMessage(webhookData.event_type, webhookData.payload);
  
  const response = await axios.post(slackWebhookUrl, slackMessage, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });

  return {
    webhook_id: webhookData.webhook_id,
    channel: 'slack',
    status: 'delivered',
    statusCode: response.status,
    responseTime: Date.now() - startTime
  };
}

// DISCORD NOTIFICATION DELIVERY  
async function deliverDiscordNotification(webhookData, startTime) {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || webhookData.payload.discord_webhook;
  
  if (!discordWebhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  const discordMessage = formatDiscordMessage(webhookData.event_type, webhookData.payload);
  
  const response = await axios.post(discordWebhookUrl, discordMessage, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });

  return {
    webhook_id: webhookData.webhook_id,
    channel: 'discord',
    status: 'delivered',
    statusCode: response.status,
    responseTime: Date.now() - startTime
  };
}

// WEBHOOK ENDPOINT MANAGEMENT
async function registerWebhookEndpoint(body, headers) {
  try {
    const { 
      organization_id, 
      url, 
      event_types, 
      secret,
      channels = ['webhook'],
      description = '' 
    } = body;

    if (!organization_id || !url || !event_types || !Array.isArray(event_types)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'organization_id, url, and event_types array are required' })
      };
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }

    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    // Insert webhook endpoint
    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        organization_id,
        url,
        event_types,
        secret: webhookSecret,
        channels,
        description,
        active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        endpoint: {
          id: endpoint.id,
          url: endpoint.url,
          event_types: endpoint.event_types,
          channels: endpoint.channels,
          secret: webhookSecret
        }
      })
    };

  } catch (error) {
    console.error('Register webhook endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to register webhook endpoint' })
    };
  }
}

// TEST WEBHOOK ENDPOINT
async function testWebhookEndpoint(body, headers) {
  try {
    const { endpoint_id, organization_id } = body;

    if (!endpoint_id || !organization_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'endpoint_id and organization_id are required' })
      };
    }

    // Get endpoint details
    const { data: endpoint } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpoint_id)
      .eq('organization_id', organization_id)
      .single();

    if (!endpoint) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Webhook endpoint not found' })
      };
    }

    // Send test webhook
    const testPayload = {
      event_type: 'test.webhook',
      test: true,
      timestamp: new Date().toISOString(),
      organization_id: organization_id
    };

    const testResult = await sendWebhookNotification({
      event_type: 'test.webhook',
      payload: testPayload,
      organization_id,
      immediate: true
    }, headers);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        test_result: JSON.parse(testResult.body),
        endpoint_url: endpoint.url
      })
    };

  } catch (error) {
    console.error('Test webhook endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to test webhook endpoint' })
    };
  }
}

// GET DELIVERY LOGS
async function getDeliveryLogs(body, headers) {
  try {
    const { organization_id, limit = 50, offset = 0, event_type = null } = body;

    if (!organization_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'organization_id is required' })
      };
    }

    let query = supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (event_type) {
      query = query.eq('event_type', event_type);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        deliveries: deliveries || [],
        pagination: {
          limit,
          offset,
          total: deliveries?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get delivery logs error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve delivery logs' })
    };
  }
}

// WEBHOOK STATISTICS
async function getWebhookStatistics(body, headers) {
  try {
    const { organization_id, days = 7 } = body;

    if (!organization_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'organization_id is required' })
      };
    }

    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    // Get delivery statistics
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('organization_id', organization_id)
      .gte('created_at', startDate);

    const stats = {
      total_deliveries: deliveries?.length || 0,
      successful_deliveries: deliveries?.filter(d => d.status === 'delivered').length || 0,
      failed_deliveries: deliveries?.filter(d => d.status === 'failed').length || 0,
      average_response_time: 0,
      delivery_by_channel: {},
      delivery_by_event: {},
      success_rate: 0
    };

    if (deliveries && deliveries.length > 0) {
      // Calculate success rate
      stats.success_rate = (stats.successful_deliveries / stats.total_deliveries) * 100;

      // Calculate average response time
      const responseTimes = deliveries
        .filter(d => d.response_time_ms)
        .map(d => d.response_time_ms);
      
      if (responseTimes.length > 0) {
        stats.average_response_time = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }

      // Group by channel
      deliveries.forEach(delivery => {
        const channel = delivery.channel || 'webhook';
        if (!stats.delivery_by_channel[channel]) {
          stats.delivery_by_channel[channel] = { total: 0, successful: 0, failed: 0 };
        }
        stats.delivery_by_channel[channel].total++;
        if (delivery.status === 'delivered') {
          stats.delivery_by_channel[channel].successful++;
        } else {
          stats.delivery_by_channel[channel].failed++;
        }
      });

      // Group by event type
      deliveries.forEach(delivery => {
        const event = delivery.event_type || 'unknown';
        if (!stats.delivery_by_event[event]) {
          stats.delivery_by_event[event] = { total: 0, successful: 0, failed: 0 };
        }
        stats.delivery_by_event[event].total++;
        if (delivery.status === 'delivered') {
          stats.delivery_by_event[event].successful++;
        } else {
          stats.delivery_by_event[event].failed++;
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        statistics: stats,
        period_days: days
      })
    };

  } catch (error) {
    console.error('Get webhook statistics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve webhook statistics' })
    };
  }
}

// UTILITY FUNCTIONS
function generateWebhookSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return `sha256=${signature}`;
}

// MESSAGE FORMATTING
function formatEmailContent(eventType, payload) {
  const templates = {
    'review.negative': {
      subject: '🚨 Negative Review Alert',
      html: `<h2>Negative Review Detected</h2><p><strong>Rating:</strong> ${payload.rating}/5</p><p><strong>Review:</strong> ${payload.content}</p><p><strong>Platform:</strong> ${payload.platform}</p>`,
      text: `Negative Review Alert\nRating: ${payload.rating}/5\nReview: ${payload.content}\nPlatform: ${payload.platform}`
    },
    'sentiment.crisis': {
      subject: '🚨 CRITICAL: Reputation Crisis',
      html: `<h2 style="color: red;">REPUTATION CRISIS ALERT</h2><p>Crisis Level: <strong>${payload.crisis_level}</strong></p><p>Immediate action required!</p>`,
      text: `REPUTATION CRISIS ALERT\nCrisis Level: ${payload.crisis_level}\nImmediate action required!`
    },
    'default': {
      subject: `SocialTrust Alert: ${eventType}`,
      html: `<h2>SocialTrust Notification</h2><p>Event: ${eventType}</p><pre>${JSON.stringify(payload, null, 2)}</pre>`,
      text: `SocialTrust Notification\nEvent: ${eventType}\n\n${JSON.stringify(payload, null, 2)}`
    }
  };

  return templates[eventType] || templates.default;
}

function formatSMSContent(eventType, payload) {
  const templates = {
    'review.negative': `🚨 Negative review: ${payload.rating}/5 on ${payload.platform}. Check dashboard now.`,
    'sentiment.crisis': `🚨 CRISIS: Reputation emergency! Take immediate action.`,
    'system.billing_issue': `💳 Billing issue detected. Update payment method immediately.`,
    'default': `SocialTrust Alert: ${eventType}. Check dashboard.`
  };

  return templates[eventType] || templates.default;
}

function formatSlackMessage(eventType, payload) {
  const color = eventType.includes('crisis') ? 'danger' : 
               eventType.includes('negative') ? 'warning' : 'good';

  return {
    text: `SocialTrust ${eventType} Alert`,
    attachments: [{
      color: color,
      title: eventType.replace(/\./g, ' ').toUpperCase(),
      fields: Object.keys(payload).slice(0, 10).map(key => ({
        title: key.replace(/_/g, ' '),
        value: String(payload[key]),
        short: true
      })),
      footer: 'SocialTrust',
      ts: Math.floor(Date.now() / 1000)
    }]
  };
}

function formatDiscordMessage(eventType, payload) {
  return {
    embeds: [{
      title: eventType.replace(/\./g, ' ').toUpperCase(),
      description: `SocialTrust ${eventType} notification`,
      color: eventType.includes('crisis') ? 15158332 : 3066993,
      fields: Object.keys(payload).slice(0, 10).map(key => ({
        name: key.replace(/_/g, ' '),
        value: String(payload[key]),
        inline: true
      })),
      timestamp: new Date().toISOString()
    }]
  };
}

// LOGGING
async function logWebhookDelivery(deliveryData) {
  try {
    await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: deliveryData.webhook_id,
        organization_id: deliveryData.organization_id,
        endpoint_id: deliveryData.endpoint_id,
        event_type: deliveryData.event_type,
        channel: deliveryData.channel,
        status: deliveryData.status,
        response_code: deliveryData.response_code,
        response_time_ms: deliveryData.response_time_ms,
        error_message: deliveryData.error_message,
        created_at: deliveryData.created_at,
        delivered_at: deliveryData.delivered_at,
        failed_at: deliveryData.failed_at
      });
  } catch (error) {
    console.error('Error logging webhook delivery:', error);
  }
}

// RETRY MECHANISM
async function scheduleWebhookRetry(webhookData, error) {
  try {
    await supabase
      .from('webhook_retries')
      .insert({
        webhook_id: webhookData.webhook_id,
        organization_id: webhookData.organization_id,
        endpoint_id: webhookData.endpoint_id,
        event_type: webhookData.event_type,
        payload: webhookData.payload,
        channel: webhookData.channel,
        retry_count: 1,
        last_error: error,
        next_retry_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
        created_at: new Date().toISOString()
      });
    
    console.log(`Scheduled retry for webhook ${webhookData.webhook_id}`);
  } catch (error) {
    console.error('Error scheduling webhook retry:', error);
  }
}