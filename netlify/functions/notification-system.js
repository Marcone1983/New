// Notification System - Email/SMS for Review Requests and Alerts
// Handles all customer communications and business notifications
const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Email service configuration (simulate multiple providers)
const EMAIL_PROVIDERS = {
  sendgrid: {
    name: 'SendGrid',
    api_endpoint: 'https://api.sendgrid.com/v3/mail/send',
    reliability: 0.98,
    delivery_time: 2000 // ms
  },
  mailgun: {
    name: 'Mailgun',
    api_endpoint: 'https://api.mailgun.net/v3/messages',
    reliability: 0.95,
    delivery_time: 3000
  },
  aws_ses: {
    name: 'AWS SES',
    api_endpoint: 'https://email.amazonaws.com',
    reliability: 0.99,
    delivery_time: 1500
  }
};

// SMS service configuration
const SMS_PROVIDERS = {
  twilio: {
    name: 'Twilio',
    api_endpoint: 'https://api.twilio.com/2010-04-01/Accounts',
    reliability: 0.97,
    delivery_time: 5000
  },
  textmagic: {
    name: 'TextMagic',
    api_endpoint: 'https://rest.textmagic.com/api/v2',
    reliability: 0.94,
    delivery_time: 7000
  }
};

// Notification templates with advanced personalization
const NOTIFICATION_TEMPLATES = {
  // Review request templates
  review_request_initial: {
    subject: "🌟 How was your experience with {business_name}?",
    html_body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Hi {customer_name}! 👋</h1>
          <p style="color: #f0f9ff; margin: 10px 0 0 0; font-size: 18px;">We'd love to hear about your experience</p>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #1f2937; margin-bottom: 20px;">How did we do?</h2>
          <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
            Thank you for choosing <strong>{business_name}</strong>! Your feedback helps us improve and helps other customers make informed decisions.
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="{review_link}" style="background: #10b981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; transition: all 0.3s;">
              ⭐ Share Your Experience
            </a>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              <strong>Why reviews matter:</strong><br>
              • Help other customers discover great businesses<br>
              • Support local businesses in your community<br>
              • Takes just 2 minutes of your time
            </p>
          </div>
          
          {custom_message}
        </div>
        
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            Best regards,<br>The {business_name} Team<br><br>
            If you'd prefer not to receive review requests, <a href="{unsubscribe_link}" style="color: #6b7280;">click here to unsubscribe</a>.
          </p>
        </div>
      </div>
    `,
    sms_body: "Hi {customer_name}! Hope you enjoyed your experience with {business_name}. Mind leaving a quick review? {review_link} Thanks! 😊"
  },
  
  review_request_reminder: {
    subject: "🙏 Just a gentle reminder about your review",
    html_body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="padding: 30px 20px; text-align: center;">
          <h2 style="color: #1f2937; margin-bottom: 20px;">Hi {customer_name},</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Just a friendly reminder about sharing your experience with <strong>{business_name}</strong>.
          </p>
          <p style="color: #6b7280;">We know you're busy, but your feedback would really help us and other customers.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{review_link}" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              📝 Quick Review (2 minutes)
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            If you'd prefer not to receive reminders, <a href="{unsubscribe_link}">click here</a>.
          </p>
        </div>
      </div>
    `,
    sms_body: "Quick reminder from {business_name} - your review would mean a lot! {review_link} (2 min) 🙏"
  },
  
  review_thank_you: {
    subject: "🎉 Thank you for your amazing review!",
    html_body: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px;">Thank You! 🌟</h1>
          <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 18px;">Your review means the world to us</p>
        </div>
        
        <div style="padding: 40px 20px; text-align: center;">
          <h2 style="color: #1f2937;">Dear {customer_name},</h2>
          <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
            We just saw your review and we're absolutely thrilled! Thank you for taking the time to share your experience with <strong>{business_name}</strong>.
          </p>
          
          <div style="background: #ecfdf5; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0; font-style: italic; color: #065f46; font-size: 16px;">
              "{review_excerpt}"
            </p>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6;">
            Reviews like yours help us continue providing excellent service and help other customers discover what we do. We can't wait to serve you again!
          </p>
          
          <div style="margin: 40px 0;">
            <a href="{business_website}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">
              Visit Our Website
            </a>
            <a href="{referral_link}" style="background: transparent; color: #6366f1; padding: 12px 24px; text-decoration: none; border-radius: 8px; border: 2px solid #6366f1; font-weight: bold;">
              Refer a Friend
            </a>
          </div>
        </div>
        
        <div style="background: #f3f4f6; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #6b7280;">
            With gratitude,<br><strong>The {business_name} Team</strong>
          </p>
        </div>
      </div>
    `
  },
  
  // Business alert notifications
  negative_review_alert: {
    subject: "⚠️ Negative Review Alert - {business_name}",
    html_body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px;">
          <h2 style="color: #7f1d1d; margin: 0 0 15px 0;">⚠️ Negative Review Alert</h2>
          <p style="color: #991b1b; margin: 0;">A negative review has been detected for <strong>{business_name}</strong>.</p>
        </div>
        
        <div style="padding: 20px;">
          <h3>Review Details:</h3>
          <ul>
            <li><strong>Rating:</strong> {rating}/5 stars</li>
            <li><strong>Platform:</strong> {platform}</li>
            <li><strong>Date:</strong> {review_date}</li>
            <li><strong>Customer:</strong> {customer_name}</li>
          </ul>
          
          <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-style: italic;">"{review_text}"</p>
          </div>
          
          <h3>Recommended Actions:</h3>
          <ul>
            <li>Respond professionally and promptly</li>
            <li>Address the customer's concerns</li>
            <li>Offer to resolve the issue offline</li>
            <li>Follow up to ensure satisfaction</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{respond_link}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Respond to Review
            </a>
          </div>
        </div>
      </div>
    `
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/notification-system', '');
  
  try {
    switch (path) {
      // Core notification sending
      case '/send-email':
        return await sendEmailNotification(event, headers);
      
      case '/send-sms':
        return await sendSMSNotification(event, headers);
      
      case '/send-bulk-notifications':
        return await sendBulkNotifications(event, headers);
      
      // Template management
      case '/get-templates':
        return await getNotificationTemplates(event, headers);
      
      case '/create-template':
        return await createCustomTemplate(event, headers);
      
      case '/test-template':
        return await testNotificationTemplate(event, headers);
      
      // Notification tracking
      case '/track-delivery':
        return await trackNotificationDelivery(event, headers);
      
      case '/get-delivery-stats':
        return await getDeliveryStatistics(event, headers);
      
      // Automated campaigns
      case '/setup-campaign':
        return await setupNotificationCampaign(event, headers);
      
      case '/trigger-campaign':
        return await triggerAutomatedCampaign(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Notification endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Notification System error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Send email notification
async function sendEmailNotification(event, headers) {
  const {
    user_email,
    to_email,
    to_name,
    template_name,
    template_data,
    business_name,
    priority = 'normal'
  } = JSON.parse(event.body || '{}');
  
  if (!user_email || !to_email || !template_name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'user_email, to_email, and template_name are required' 
      })
    };
  }

  console.log(`📧 Email notification: ${template_name} to ${to_email} from ${user_email}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Get template
  const template = NOTIFICATION_TEMPLATES[template_name];
  if (!template) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Template not found' })
    };
  }

  // Process template with data
  const processedEmail = processEmailTemplate(template, {
    to_name,
    business_name,
    ...template_data
  });

  // Select email provider based on priority
  const provider = selectEmailProvider(priority);
  
  // Create notification record
  const notificationId = generateNotificationId();
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({
      id: notificationId,
      organization_id: org.id,
      type: 'email',
      template_name,
      recipient_email: to_email,
      recipient_name: to_name,
      subject: processedEmail.subject,
      content: processedEmail.html_body,
      provider: provider.name,
      status: 'sending',
      priority,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating notification record:', insertError);
    throw insertError;
  }

  // Send email via provider
  const deliveryResult = await sendViaEmailProvider(provider, {
    to: { email: to_email, name: to_name },
    subject: processedEmail.subject,
    html: processedEmail.html_body,
    business_name: business_name
  });

  // Update notification status
  await supabase
    .from('notifications')
    .update({
      status: deliveryResult.success ? 'delivered' : 'failed',
      delivery_details: deliveryResult,
      delivered_at: deliveryResult.success ? new Date().toISOString() : null,
      error_message: deliveryResult.success ? null : deliveryResult.error
    })
    .eq('id', notificationId);

  console.log(`${deliveryResult.success ? '✅' : '❌'} Email ${deliveryResult.success ? 'sent' : 'failed'}: ${to_email}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: deliveryResult.success,
      notification_id: notificationId,
      provider: provider.name,
      delivery_details: deliveryResult,
      estimated_delivery: new Date(Date.now() + provider.delivery_time).toISOString()
    })
  };
}

// Send SMS notification
async function sendSMSNotification(event, headers) {
  const {
    user_email,
    to_phone,
    to_name,
    template_name,
    template_data,
    business_name
  } = JSON.parse(event.body || '{}');
  
  if (!user_email || !to_phone || !template_name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'user_email, to_phone, and template_name are required' 
      })
    };
  }

  console.log(`📱 SMS notification: ${template_name} to ${to_phone} from ${user_email}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Get template
  const template = NOTIFICATION_TEMPLATES[template_name];
  if (!template || !template.sms_body) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'SMS template not found' })
    };
  }

  // Process SMS template
  const processedSMS = processSMSTemplate(template.sms_body, {
    customer_name: to_name,
    business_name,
    ...template_data
  });

  // Select SMS provider
  const provider = selectSMSProvider();
  
  // Create notification record
  const notificationId = generateNotificationId();
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({
      id: notificationId,
      organization_id: org.id,
      type: 'sms',
      template_name,
      recipient_phone: to_phone,
      recipient_name: to_name,
      content: processedSMS,
      provider: provider.name,
      status: 'sending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  // Send SMS
  const deliveryResult = await sendViaSMSProvider(provider, {
    to: to_phone,
    message: processedSMS,
    business_name
  });

  // Update notification status
  await supabase
    .from('notifications')
    .update({
      status: deliveryResult.success ? 'delivered' : 'failed',
      delivery_details: deliveryResult,
      delivered_at: deliveryResult.success ? new Date().toISOString() : null,
      error_message: deliveryResult.success ? null : deliveryResult.error
    })
    .eq('id', notificationId);

  console.log(`${deliveryResult.success ? '✅' : '❌'} SMS ${deliveryResult.success ? 'sent' : 'failed'}: ${to_phone}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: deliveryResult.success,
      notification_id: notificationId,
      provider: provider.name,
      delivery_details: deliveryResult,
      estimated_delivery: new Date(Date.now() + provider.delivery_time).toISOString()
    })
  };
}

// Send bulk notifications
async function sendBulkNotifications(event, headers) {
  const {
    user_email,
    recipients, // Array of {email, name, phone, template_data}
    template_name,
    notification_type = 'email',
    business_name,
    batch_name
  } = JSON.parse(event.body || '{}');
  
  if (!user_email || !recipients || !Array.isArray(recipients) || !template_name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'user_email, recipients array, and template_name are required' 
      })
    };
  }

  console.log(`📨 Bulk notifications: ${recipients.length} ${notification_type} notifications for ${user_email}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const results = [];
  const batchId = generateBatchId();

  // Process each recipient
  for (const recipient of recipients) {
    try {
      const notificationRequest = {
        body: JSON.stringify({
          user_email,
          [notification_type === 'email' ? 'to_email' : 'to_phone']: 
            notification_type === 'email' ? recipient.email : recipient.phone,
          to_name: recipient.name,
          template_name,
          template_data: recipient.template_data || {},
          business_name
        })
      };

      const result = notification_type === 'email' ? 
        await sendEmailNotification(notificationRequest, headers) :
        await sendSMSNotification(notificationRequest, headers);

      const resultData = JSON.parse(result.body);
      
      results.push({
        recipient: recipient.name,
        [notification_type === 'email' ? 'email' : 'phone']: 
          notification_type === 'email' ? recipient.email : recipient.phone,
        success: resultData.success,
        notification_id: resultData.notification_id,
        error: resultData.error || null
      });

    } catch (error) {
      results.push({
        recipient: recipient.name,
        success: false,
        error: error.message
      });
    }

    // Small delay to prevent overwhelming providers
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Create batch record
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  await supabase
    .from('notification_batches')
    .insert({
      id: batchId,
      organization_id: org.id,
      batch_name: batch_name || `Bulk ${notification_type} - ${new Date().toISOString().split('T')[0]}`,
      notification_type,
      template_name,
      total_recipients: recipients.length,
      successful_deliveries: successCount,
      failed_deliveries: failureCount,
      created_at: new Date().toISOString()
    });

  console.log(`✅ Bulk campaign completed: ${successCount} sent, ${failureCount} failed`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      batch_id: batchId,
      summary: {
        total_recipients: recipients.length,
        successful_deliveries: successCount,
        failed_deliveries: failureCount,
        success_rate: Math.round((successCount / recipients.length) * 100)
      },
      results
    })
  };
}

// Get delivery statistics
async function getDeliveryStatistics(event, headers) {
  const { user_email, days = '30' } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const daysInt = parseInt(days);
  const startDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000).toISOString();

  // Get notification stats
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', org.id)
    .gte('created_at', startDate);

  if (error) {
    throw error;
  }

  // Calculate statistics
  const stats = calculateDeliveryStatistics(notifications || []);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      period_days: daysInt,
      statistics: stats
    })
  };
}

// Helper functions
function processEmailTemplate(template, data) {
  let subject = template.subject;
  let htmlBody = template.html_body;

  // Replace all placeholders
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value || '');
    htmlBody = htmlBody.replace(new RegExp(placeholder, 'g'), value || '');
  });

  // Handle custom message insertion
  if (data.custom_message) {
    const customMessageHtml = `<div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #1e40af; font-style: italic;">${data.custom_message}</p>
    </div>`;
    htmlBody = htmlBody.replace('{custom_message}', customMessageHtml);
  } else {
    htmlBody = htmlBody.replace('{custom_message}', '');
  }

  return { subject, html_body: htmlBody };
}

function processSMSTemplate(template, data) {
  let message = template;

  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value || '');
  });

  return message;
}

function selectEmailProvider(priority) {
  // Select based on priority and reliability
  if (priority === 'high') {
    return EMAIL_PROVIDERS.aws_ses; // Most reliable
  } else if (priority === 'normal') {
    return EMAIL_PROVIDERS.sendgrid;
  } else {
    return EMAIL_PROVIDERS.mailgun;
  }
}

function selectSMSProvider() {
  return SMS_PROVIDERS.twilio; // Default to Twilio
}

async function sendViaEmailProvider(provider, emailData) {
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, provider.delivery_time));
  
  const success = Math.random() < provider.reliability;
  
  return {
    success,
    provider: provider.name,
    message_id: success ? generateMessageId() : null,
    error: success ? null : 'Simulated delivery failure',
    delivery_time: provider.delivery_time,
    timestamp: new Date().toISOString()
  };
}

async function sendViaSMSProvider(provider, smsData) {
  await new Promise(resolve => setTimeout(resolve, provider.delivery_time));
  
  const success = Math.random() < provider.reliability;
  
  return {
    success,
    provider: provider.name,
    message_id: success ? generateMessageId() : null,
    error: success ? null : 'SMS delivery failed',
    delivery_time: provider.delivery_time,
    timestamp: new Date().toISOString()
  };
}

function calculateDeliveryStatistics(notifications) {
  const total = notifications.length;
  const delivered = notifications.filter(n => n.status === 'delivered').length;
  const failed = notifications.filter(n => n.status === 'failed').length;
  const pending = notifications.filter(n => n.status === 'sending').length;

  // Group by type
  const emailCount = notifications.filter(n => n.type === 'email').length;
  const smsCount = notifications.filter(n => n.type === 'sms').length;

  // Group by template
  const templateStats = {};
  notifications.forEach(n => {
    if (!templateStats[n.template_name]) {
      templateStats[n.template_name] = { sent: 0, delivered: 0 };
    }
    templateStats[n.template_name].sent++;
    if (n.status === 'delivered') {
      templateStats[n.template_name].delivered++;
    }
  });

  return {
    overview: {
      total_notifications: total,
      delivered: delivered,
      failed: failed,
      pending: pending,
      delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 0
    },
    by_type: {
      email: emailCount,
      sms: smsCount
    },
    by_template: Object.entries(templateStats).map(([template, stats]) => ({
      template_name: template,
      sent: stats.sent,
      delivered: stats.delivered,
      delivery_rate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0
    })),
    recent_activity: notifications
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(n => ({
        type: n.type,
        template: n.template_name,
        recipient: n.recipient_email || n.recipient_phone,
        status: n.status,
        created_at: n.created_at
      }))
  };
}

function generateNotificationId() {
  return 'notif_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateBatchId() {
  return 'batch_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}